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
      { id: 'dark', label: 'THEME_DARK', fileBase: 'screenshot-dark' },
      { id: 'light', label: 'THEME_LIGHT', fileBase: 'screenshot-light' },
      { id: 'cmd', label: 'THEME_CMD', fileBase: 'screenshot-cmd' },
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
    const elements = Array.from(document.querySelectorAll('button, [role="button"], a'))
    const match = elements.find((el) => (el.textContent || '').trim().includes(text))
    if (!match) return false
    ;(match).click()
    return true
  }, needle)

  if (!clicked) {
    throw new Error(`Could not find clickable element containing text: ${needle}`)
  }
}

async function openMenu(page) {
  await clickFirstByText(page, '≡')
}

async function setTheme(page, themeLabel) {
  await openMenu(page)
  await clickFirstByText(page, themeLabel)
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
  await page.setViewport(viewport)
  await gotoApp(page, url)
  await setTheme(page, theme.label)

  const outPath = path.join(outDir, `${theme.fileBase}${viewport.isMobile ? '-mobile' : ''}.png`)
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
