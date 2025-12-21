import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import puppeteer from 'puppeteer-core'

function parseArgs(argv) {
  const args = {
    inFile: 'public/pwa.svg',
    outDir: 'public/icons',
    sizes: [32, 192, 512],
    headless: true,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--in') args.inFile = argv[++i]
    else if (arg === '--out-dir') args.outDir = argv[++i]
    else if (arg === '--sizes') args.sizes = argv[++i].split(',').map((s) => Number(s.trim())).filter(Boolean)
    else if (arg === '--headed') args.headless = false
    else if (arg === '--headless') args.headless = true
    else if (arg === '--help') {
      // eslint-disable-next-line no-console
      console.log(`Usage: node scripts/render-icons.mjs [options]

Options:
  --in <path>          Input SVG file (default: public/pwa.svg)
  --out-dir <dir>      Output directory (default: public/icons)
  --sizes <csv>        PNG sizes (default: 32,192,512)
  --headed             Run with visible browser
  --headless           Run headless (default)
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
      return (
        process.env.CHROME_PATH ||
        'C:/Program Files/Google/Chrome/Application/chrome.exe'
      )
    }
    default: {
      return 'google-chrome'
    }
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

function toHtml(svgSource, size) {
  const svgEscaped = svgSource
    .replaceAll('</script', '<\\/script')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
      .wrap { width: ${size}px; height: ${size}px; display: grid; place-items: center; }
      svg { width: ${size}px; height: ${size}px; display: block; }
    </style>
  </head>
  <body>
    <div class="wrap">${svgEscaped}</div>
  </body>
</html>`
}

async function renderOne(page, { svgSource, size, outPath }) {
  await page.setViewport({
    width: size,
    height: size,
    deviceScaleFactor: 1,
  })

  await page.setContent(toHtml(svgSource, size), { waitUntil: 'load' })

  const svgEl = await page.$('svg')
  if (!svgEl) throw new Error('Could not find <svg> element on the page')

  await svgEl.screenshot({ path: outPath })
}

async function main() {
  const args = parseArgs(process.argv)

  const inAbs = path.resolve(process.cwd(), args.inFile)
  const outDirAbs = path.resolve(process.cwd(), args.outDir)
  await ensureDir(outDirAbs)

  const svgSource = await fs.readFile(inAbs, 'utf8')

  const chromeExecutablePath = getDefaultChromeExecutablePath()

  const browser = await puppeteer.launch({
    executablePath: chromeExecutablePath,
    headless: args.headless,
    defaultViewport: null,
    args: ['--no-sandbox'],
  })

  try {
    const page = await browser.newPage()

    for (const size of args.sizes) {
      const outPath = path.join(outDirAbs, `ykhn-${size}.png`)
      await renderOne(page, { svgSource, size, outPath })
      // eslint-disable-next-line no-console
      console.log(`Wrote ${outPath}`)
    }
  } finally {
    await browser.close()
  }
}

await main()
