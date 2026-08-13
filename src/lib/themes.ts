export type BuiltInTheme = 'commander' | 'dark' | 'light'

export type ThemeAppearance = 'dark' | 'light'

export type ThemeColors = {
  background: string
  text: string
  border: string
  gray: string
  active: string
  cyan: string
  yellow: string
}

export type ThemeCollection = {
  id: string
  label: string
  extensionId: string
  version: string
  license: string
}

export type InstalledTheme = {
  id: `open-vsx:${string}`
  label: string
  appearance: ThemeAppearance
  colors: ThemeColors
  collection: ThemeCollection
}

type Rgb = { r: number; g: number; b: number }
type Rgba = Rgb & { a: number }

const COLOR_KEYS = ['background', 'text', 'border', 'gray', 'active', 'cyan', 'yellow'] as const

export const builtInThemes: ReadonlyArray<{ id: BuiltInTheme; label: string }> = [
  { id: 'commander', label: 'Commander' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

export function isBuiltInTheme(value: unknown): value is BuiltInTheme {
  return value === 'commander' || value === 'dark' || value === 'light'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseColor(value: unknown): Rgba | null {
  if (typeof value !== 'string') return null
  const hex = value.trim().replace(/^#/, '')
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) return null

  const channel = (part: string) =>
    part.length === 1 ? Number.parseInt(part + part, 16) : Number.parseInt(part, 16)

  if (hex.length <= 4) {
    return {
      r: channel(hex[0]!),
      g: channel(hex[1]!),
      b: channel(hex[2]!),
      a: hex.length === 4 ? channel(hex[3]!) / 255 : 1,
    }
  }

  return {
    r: channel(hex.slice(0, 2)),
    g: channel(hex.slice(2, 4)),
    b: channel(hex.slice(4, 6)),
    a: hex.length === 8 ? channel(hex.slice(6, 8)) / 255 : 1,
  }
}

function toHex(color: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`
}

function flatten(color: Rgba, background: Rgb): Rgb {
  return {
    r: color.r * color.a + background.r * (1 - color.a),
    g: color.g * color.a + background.g * (1 - color.a),
    b: color.b * color.a + background.b * (1 - color.a),
  }
}

function mix(first: Rgb, second: Rgb, secondWeight: number): Rgb {
  return {
    r: first.r * (1 - secondWeight) + second.r * secondWeight,
    g: first.g * (1 - secondWeight) + second.g * secondWeight,
    b: first.b * (1 - secondWeight) + second.b * secondWeight,
  }
}

function luminance(color: Rgb): number {
  const channel = (value: number) => {
    const ratio = value / 255
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrast(first: Rgb, second: Rgb): number {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function readableEnd(background: Rgb): Rgb {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  return contrast(white, background) >= contrast(black, background) ? white : black
}

function pickColor(
  colors: Record<string, unknown>,
  background: Rgb,
  keys: ReadonlyArray<string>,
): Rgb | null {
  for (const key of keys) {
    const parsed = parseColor(colors[key])
    if (parsed) return flatten(parsed, background)
  }
  return null
}

function readableColor(candidate: Rgb | null, background: Rgb, minimum = 4.5): Rgb {
  if (candidate && contrast(candidate, background) >= minimum) return candidate
  return readableEnd(background)
}

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const label = value.trim().replace(/\s+/g, ' ')
  return label ? label.slice(0, 64) : fallback
}

export function convertVsCodeTheme(
  value: unknown,
  options: {
    id: `open-vsx:${string}`
    fallbackLabel: string
    contributionLabel?: unknown
    contributionType?: unknown
    collection: ThemeCollection
  },
): InstalledTheme {
  if (!isRecord(value) || !isRecord(value.colors)) {
    throw new Error('The color theme is not a readable VS Code theme.')
  }

  const colors = value.colors
  const backgroundValue = parseColor(colors['editor.background'] ?? colors['editorPane.background'])
  if (!backgroundValue) {
    throw new Error('The color theme has no usable editor.background color.')
  }

  const background = flatten(backgroundValue, { r: 0, g: 0, b: 0 })
  const specifiedType =
    typeof options.contributionType === 'string'
      ? options.contributionType
      : typeof value.type === 'string'
        ? value.type
        : ''
  const appearance: ThemeAppearance =
    specifiedType === 'vs' || specifiedType === 'hc-light'
      ? 'light'
      : specifiedType === 'vs-dark' || specifiedType === 'hc-black'
        ? 'dark'
        : luminance(background) < 0.179
          ? 'dark'
          : 'light'

  const text = readableColor(
    pickColor(colors, background, ['editor.foreground', 'foreground']),
    background,
  )
  const border = readableColor(
    pickColor(colors, background, ['contrastBorder', 'panel.border', 'focusBorder']),
    background,
    3,
  )
  const accent = readableColor(
    pickColor(colors, background, [
      'textLink.foreground',
      'focusBorder',
      'activityBarBadge.background',
      'button.background',
    ]),
    background,
    3,
  )
  const warning = readableColor(
    pickColor(colors, background, [
      'editorWarning.foreground',
      'terminal.ansiYellow',
      'charts.yellow',
    ]),
    background,
    3,
  )
  const active =
    pickColor(colors, background, [
      'list.activeSelectionBackground',
      'list.hoverBackground',
      'editor.selectionBackground',
    ]) ?? mix(background, text, appearance === 'dark' ? 0.2 : 0.12)
  const gray = mix(background, text, appearance === 'dark' ? 0.4 : 0.32)

  return {
    id: options.id,
    label: safeLabel(options.contributionLabel ?? value.name, options.fallbackLabel),
    appearance,
    colors: {
      background: toHex(background),
      text: toHex(text),
      border: toHex(border),
      gray: toHex(gray),
      active: toHex(active),
      cyan: toHex(accent),
      yellow: toHex(warning),
    },
    collection: options.collection,
  }
}

export function isInstalledTheme(value: unknown): value is InstalledTheme {
  if (!isRecord(value) || !isRecord(value.colors) || !isRecord(value.collection)) return false
  const colors = value.colors
  if (
    typeof value.id !== 'string' ||
    !/^open-vsx:[a-z0-9._:-]+$/i.test(value.id) ||
    typeof value.label !== 'string' ||
    value.label.length === 0 ||
    value.label.length > 64 ||
    (value.appearance !== 'dark' && value.appearance !== 'light')
  ) {
    return false
  }

  if (!COLOR_KEYS.every((key) => typeof colors[key] === 'string' && parseColor(colors[key]))) {
    return false
  }

  return (
    typeof value.collection.id === 'string' &&
    typeof value.collection.label === 'string' &&
    typeof value.collection.extensionId === 'string' &&
    typeof value.collection.version === 'string' &&
    typeof value.collection.license === 'string'
  )
}
