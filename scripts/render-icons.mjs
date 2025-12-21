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
    rounded: false,
    roundedRadius: 0.223,
    inset: null,
    background: 'transparent',
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--in') args.inFile = argv[++i]
    else if (arg === '--out-dir') args.outDir = argv[++i]
    else if (arg === '--sizes') args.sizes = argv[++i].split(',').map((s) => Number(s.trim())).filter(Boolean)
    else if (arg === '--rounded') args.rounded = true
    else if (arg === '--rounded-radius') args.roundedRadius = Number(argv[++i])
    else if (arg === '--inset') args.inset = Number(argv[++i])
    else if (arg === '--background') args.background = argv[++i]
    else if (arg === '--headed') args.headless = false
    else if (arg === '--headless') args.headless = true
    else if (arg === '--help') {
      // eslint-disable-next-line no-console
      console.log(`Usage: node scripts/render-icons.mjs [options]

Options:
  --in <path>               Input SVG file (default: public/pwa.svg)
  --out-dir <dir>           Output directory (default: public/icons)
  --sizes <csv>             PNG sizes (default: 32,192,512)
  --rounded                 Also render rounded-corner variants
  --rounded-radius <ratio>  Corner radius ratio of size (default: 0.223)
  --inset <ratio>           Safe-area inset ratio (default: 0.10 for rounded; 0 otherwise)
  --background <cssColor>   Background for output (default: transparent)
  --headed                  Run with visible browser
  --headless                Run headless (default)
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

function toHtml(svgSource, size, { rounded, radiusPx, insetPx, background }) {
  const svgEscaped = svgSource
    .replaceAll('</script', '<\\/script')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: transparent;
      }
      .wrap {
        width: ${size}px;
        height: ${size}px;
        display: grid;
        place-items: center;
      }
      .frame {
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: ${background};
        border-radius: ${rounded ? `${radiusPx}px` : '0px'};
        box-sizing: border-box;
        padding: ${insetPx}px;
      }
      .frame > svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="wrap"><div class="frame">${svgEscaped}</div></div>
  </body>
</html>`
}

async function renderOne(page, { svgSource, size, outPath, rounded, roundedRadius, inset, background }) {
  await page.setViewport({
    width: size,
    height: size,
    deviceScaleFactor: 1,
  })

  const radiusRatio = Number.isFinite(roundedRadius) ? roundedRadius : 0
  const clampedRadiusRatio = Math.max(0, Math.min(0.5, radiusRatio))
  const radiusPx = Math.round(size * clampedRadiusRatio)

  const defaultInsetRatio = rounded ? 0.1 : 0
  const insetRatio = inset === null ? defaultInsetRatio : inset
  const clampedInsetRatio = Math.max(0, Math.min(0.3, Number.isFinite(insetRatio) ? insetRatio : 0))
  const insetPx = Math.round(size * clampedInsetRatio)

  await page.setContent(toHtml(svgSource, size, { rounded, radiusPx, insetPx, background }), { waitUntil: 'load' })

  const svgEl = await page.$('svg')
  if (!svgEl) throw new Error('Could not find <svg> element on the page')

  const frameEl = await page.$('.frame')
  if (!frameEl) throw new Error('Could not find .frame element on the page')

  await frameEl.screenshot({ path: outPath })
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
      await renderOne(page, {
        svgSource,
        size,
        outPath,
        rounded: false,
        roundedRadius: args.roundedRadius,
        inset: args.inset,
        background: args.background,
      })
      // eslint-disable-next-line no-console
      console.log(`Wrote ${outPath}`)

      if (args.rounded) {
        const roundedOutPath = path.join(outDirAbs, `ykhn-${size}-rounded.png`)
        await renderOne(page, {
          svgSource,
          size,
          outPath: roundedOutPath,
          rounded: true,
          roundedRadius: args.roundedRadius,
          inset: args.inset,
          background: args.background,
        })
        // eslint-disable-next-line no-console
        console.log(`Wrote ${roundedOutPath}`)
      }
    }
  } finally {
    await browser.close()
  }
}

await main()
