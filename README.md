# YKHN

Retro terminal Hacker News client.

## Screenshots

| Theme | Desktop | Mobile |
| --- | --- | --- |
| Dark | ![Dark theme desktop screenshot](public/screenshot-dark.png) | ![Dark theme mobile screenshot](public/screenshot-dark-mobile.png) |
| Light | ![Light theme desktop screenshot](public/screenshot-light.png) | ![Light theme mobile screenshot](public/screenshot-light-mobile.png) |
| Commander | ![Commander theme desktop screenshot](public/screenshot-cmd.png) | ![Commander theme mobile screenshot](public/screenshot-cmd-mobile.png) |

## Development

- `bun install`
- `bun run dev` (Vite @ `http://localhost:5173`)

## Icons

Generate PWA icons from `public/pwa.svg`:

- `node scripts/render-icons.mjs`
- Rounded-corner variants (for iOS): `node scripts/render-icons.mjs --rounded`
- Custom radius / inset / background: `node scripts/render-icons.mjs --rounded --rounded-radius 0.22 --inset 0.10 --background "#fff"`

## Keyboard shortcuts

- `?` toggle shortcuts overlay
- `Esc` close menus/help
- `F1..F6` switch feeds
- `j` / `k` move selection (list + comments)
- `gg` / `G` jump to top/bottom
- `[count]j` / `[count]k` / `[count]G` numeric prefix
- `zt` / `zz` / `zb` scroll active to top/center/bottom
- `Enter` / `d` open comments; `D` opens in new tab
- `o` open link; `O` opens in new tab
- `r` refresh current page
- `PgUp` / `PgDn` prev/next page or load more
- `Ctrl+o` / `Ctrl+i` browser back/forward
- `Ctrl+y` / `Ctrl+e` scroll one row
- `Ctrl+u` / `Ctrl+d` scroll half page
- `Ctrl+b` / `Ctrl+f` scroll full page

## License

MIT

