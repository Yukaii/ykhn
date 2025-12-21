import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import puppeteer from 'puppeteer-core'

function parseArgs(argv) {
  const args = {
    url: 'http://localhost:5173',
    outDir: 'public',
    desktopViewport: { width: 1440, height: 900 },
    mobileViewport: { width: 390, height: 844 },
    themes: [
      { id: 'dark', domTheme: 'dark', fileBase: 'screenshot-dark' },
      { id: 'light', domTheme: 'light', fileBase: 'screenshot-light' },
      { id: 'commander', domTheme: 'commander', fileBase: 'screenshot-cmd' },
    ],
    headless: true,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--url') args.url = argv[++i]
    else if (arg === '--out-dir') args.outDir = argv[++i]
    else if (arg === '--headed') args.headless = false
    else if (arg === '--headless') args.headless = true
    else if (arg === '--help') {
      // eslint-disable-next-line no-console
      console.log(`Usage: node scripts/update-screenshots.mjs [options]

Options:
  --url <url>         App URL (default: http://localhost:5173)
  --out-dir <dir>     Output directory (default: public)
  --headed            Run with visible browser
  --headless          Run headless (default)
`)
      process.exit(0)
    }
  }

  return args
}

function getDefaultChromeExecutablePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  switch (process.platform) {
    case 'darwin': {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    }
    case 'win32': {
      // Try the most common install locations.
      return (
        process.env.CHROME_PATH ||
        'C:/Program Files/Google/Chrome/Application/chrome.exe'
      )
    }
    default: {
      // linux
      return 'google-chrome'
    }
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function clickFirstByText(page, needle) {
  const clicked = await page.evaluate((text) => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    const selectors = [
      'button',
      '[role="button"]',
      '[role="menuitem"]',
      '[role="option"]',
      'a',
      'li',
      'div',
      'span',
    ]

    const elements = selectors.flatMap((sel) => Array.from(document.querySelectorAll(sel)))

    const match = elements.find((el) => {
      if (!isVisible(el)) return false
      const t = (el.textContent || '').trim()
      return t === text || t.includes(text)
    })

    if (!match) return false

    match.scrollIntoView({ block: 'center' })
    match.click()
    return true
  }, needle)

  if (!clicked) {
    throw new Error(`Could not find element containing text: ${needle}`)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function applyTheme(page, domTheme) {
  await page.evaluate((theme) => {
    try {
      localStorage.setItem('ykhn-theme', theme)
    } catch {
      // ignore
    }

    document.documentElement.dataset.theme = theme
  }, domTheme)

  await sleep(50)

  const applied = await page.evaluate(() => document.documentElement.dataset.theme)
  if (applied !== domTheme) {
    throw new Error(`Theme did not apply (wanted ${domTheme}, got ${applied})`)
  }
}

async function dismissOverlays(page, { timeoutMs = 8000 } = {}) {
  const start = Date.now()

  const clickDismiss = async () => {
    const point = await page.evaluate(() => {
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }

      const button = Array.from(document.querySelectorAll('button')).find((el) => {
        if (!isVisible(el)) return false
        const t = (el.textContent || '').trim().toUpperCase()
        return t.includes('[DISMISS]')
      })

      if (!button) return null

      const rect = button.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    })

    if (!point) return false

    await page.mouse.click(point.x, point.y)
    return true
  }

  const hasDismiss = async () => {
    return page.evaluate(() => {
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }

      const button = Array.from(document.querySelectorAll('button')).find((el) => {
        if (!isVisible(el)) return false
        const t = (el.textContent || '').trim().toUpperCase()
        return t.includes('[DISMISS]')
      })

      return Boolean(button)
    })
  }

  while (Date.now() - start < timeoutMs) {
    const clicked = await clickDismiss()
    if (clicked) {
      await sleep(250)
      continue
    }

    const stillThere = await hasDismiss()
    if (!stillThere) return

    await sleep(250)
  }

  const stillThere = await hasDismiss()
  if (stillThere) {
    throw new Error('Timed out waiting for DISMISS overlay to disappear')
  }
}

async function gotoApp(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2' })
  // Wait for something stable on the page.
  await page.waitForFunction(
    () => document.body?.innerText.includes('YKHN_OS'),
    { timeout: 30_000 },
  )
}

async function captureTheme(page, { url, outDir, viewport, theme }) {
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: viewport.isMobile ? 2 : 1,
  })

  await gotoApp(page, url)
  await applyTheme(page, theme.domTheme)
  await sleep(600)
  await dismissOverlays(page)

  const outPath = path.join(
    outDir,
    `${theme.fileBase}${viewport.isMobile ? '-mobile' : ''}.png`,
  )

  await page.screenshot({ path: outPath, fullPage: true })
}

async function main() {
  const args = parseArgs(process.argv)

  const outDirAbs = path.resolve(process.cwd(), args.outDir)
  await ensureDir(outDirAbs)

  const chromeExecutablePath = getDefaultChromeExecutablePath()

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath,
    headless: args.headless,
    defaultViewport: null,
    args: ['--no-sandbox'],
  })

  try {
    const page = await browser.newPage()

    for (const theme of args.themes) {
      await captureTheme(page, {
        url: args.url,
        outDir: outDirAbs,
        viewport: { ...args.desktopViewport, isMobile: false },
        theme,
      })

      await captureTheme(page, {
        url: args.url,
        outDir: outDirAbs,
        viewport: { ...args.mobileViewport, isMobile: true },
        theme,
      })
    }
  } finally {
    await browser.close()
  }
}

await main()
