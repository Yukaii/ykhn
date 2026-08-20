import type JSZip from 'jszip'
import { parse, type ParseError } from 'jsonc-parser'

import { convertVsCodeTheme, type InstalledTheme, type ThemeCollection } from './themes'

const OPEN_VSX_SEARCH_URL = 'https://open-vsx.org/api/-/search'
const MAX_SEARCH_BYTES = 512 * 1024
const MAX_DETAIL_BYTES = 256 * 1024
const MAX_MANIFEST_BYTES = 256 * 1024
const MAX_THEME_BYTES = 256 * 1024
const MAX_VSIX_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRIES = 5_000
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 200
const MAX_THEMES_PER_EXTENSION = 40
const MAX_INCLUDE_DEPTH = 8
const MAX_PACKAGE_PATH_LENGTH = 1_024
const SEARCH_TIMEOUT_MS = 10_000

const SUPPORTED_LICENSES = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Unlicense',
])

const USED_COLOR_KEYS = new Set([
  'activityBarBadge.background',
  'button.background',
  'charts.yellow',
  'contrastBorder',
  'editor.background',
  'editor.foreground',
  'editor.selectionBackground',
  'editorPane.background',
  'editorWarning.foreground',
  'focusBorder',
  'foreground',
  'list.activeSelectionBackground',
  'list.hoverBackground',
  'panel.border',
  'terminal.ansiYellow',
  'textLink.foreground',
])

export type OpenVsxThemeSort = 'downloadCount' | 'rating' | 'timestamp' | 'relevance'

export type OpenVsxThemeExtension = {
  id: string
  collectionId: string
  name: string
  publisher: string
  description: string
  downloadCount: number
  iconUrl: string | null
  sourceUrl: string | null
  manifestUrl: string
  checksumUrl: string
  downloadUrl: string
  version: string
  license: string
}

export type ThemeImportProgress = 'manifest' | 'download' | 'verify' | 'extract'

type ThemeContribution = { label?: unknown; uiTheme?: unknown; path?: unknown }

type InspectableZipObject = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: unknown }
  unsafeOriginalName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function themeId(extensionId: string, path: string): `open-vsx:${string}` {
  const normalizedExtension = extensionId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return `open-vsx:${normalizedExtension}:${shortHash(path)}`
}

function collectionId(extensionId: string): string {
  const normalized = extensionId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return `open-vsx:${normalized}`
}

function trustedOpenVsxUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'open-vsx.org'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function publicSourceUrl(value: unknown): string | null {
  const raw =
    typeof value === 'string'
      ? value
      : isRecord(value) && typeof value.url === 'string'
        ? value.url
        : null
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}

function themeContributions(manifest: Record<string, unknown>): ThemeContribution[] {
  const contributes = isRecord(manifest.contributes) ? manifest.contributes : null
  return Array.isArray(contributes?.themes)
    ? (contributes.themes.filter(isRecord) as ThemeContribution[])
    : []
}

function manifestLicenseMatches(manifest: Record<string, unknown>, license: string): boolean {
  return (
    typeof manifest.license === 'string' &&
    manifest.license.trim().toLowerCase() === license.toLowerCase()
  )
}

function extensionFromDetail(value: unknown): OpenVsxThemeExtension | null {
  if (!isRecord(value) || !isRecord(value.files)) {
    throw new Error('Open VSX returned malformed theme details.')
  }

  const publisher = typeof value.namespace === 'string' ? value.namespace.trim() : ''
  const extensionName = typeof value.name === 'string' ? value.name.trim() : ''
  const name =
    (typeof value.displayName === 'string' ? value.displayName.trim() : '') || extensionName
  const version = typeof value.version === 'string' ? value.version.trim() : ''
  const license = typeof value.license === 'string' ? value.license.trim() : ''
  const manifestUrl = trustedOpenVsxUrl(value.files.manifest)
  const checksumUrl = trustedOpenVsxUrl(value.files.sha256)
  const downloadUrl = trustedOpenVsxUrl(value.files.download)

  if (!publisher || !extensionName || !version || !manifestUrl || !checksumUrl || !downloadUrl) {
    throw new Error('Open VSX returned malformed theme details.')
  }
  if (!SUPPORTED_LICENSES.has(license)) return null

  const id = `${publisher}.${extensionName}`
  return {
    id,
    collectionId: collectionId(id),
    name,
    publisher,
    description: typeof value.description === 'string' ? value.description : '',
    downloadCount:
      typeof value.downloadCount === 'number' && Number.isFinite(value.downloadCount)
        ? value.downloadCount
        : 0,
    iconUrl: trustedOpenVsxUrl(value.files.icon),
    sourceUrl:
      publicSourceUrl(value.repository) ??
      publicSourceUrl(value.homepage) ??
      publicSourceUrl(value.url),
    manifestUrl,
    checksumUrl,
    downloadUrl,
    version,
    license,
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal,
) {
  const controller = new AbortController()
  const abort = () => controller.abort(parent?.reason)
  if (parent?.aborted) abort()
  else parent?.addEventListener('abort', abort, { once: true })
  const timeout = globalThis.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    return await operation(controller.signal)
  } catch (cause) {
    if (controller.signal.aborted && !parent?.aborted) {
      throw new Error('Open VSX took too long to respond.')
    }
    throw cause
  } finally {
    globalThis.clearTimeout(timeout)
    parent?.removeEventListener('abort', abort)
  }
}

async function readCappedResponse(
  response: Response,
  limit: number,
  tooLargeMessage: string,
): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > limit) throw new Error(tooLargeMessage)
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > limit) throw new Error(tooLargeMessage)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > limit) {
        await reader.cancel()
        throw new Error(tooLargeMessage)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function parseJsoncObject(source: string, description: string): Record<string, unknown> {
  const errors: ParseError[] = []
  const value: unknown = parse(source, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !isRecord(value)) throw new Error(`${description} is not valid JSON.`)
  return value
}

export async function searchOpenVsxThemes(
  query: string,
  options: { signal?: AbortSignal; sortBy?: OpenVsxThemeSort } = {},
): Promise<OpenVsxThemeExtension[]> {
  const searchText = query.trim()
  if (!searchText) return []

  const url = new URL(OPEN_VSX_SEARCH_URL)
  url.searchParams.set('query', searchText)
  url.searchParams.set('category', 'Themes')
  url.searchParams.set('sortBy', options.sortBy ?? 'downloadCount')
  url.searchParams.set('sortOrder', 'desc')
  url.searchParams.set('size', '16')

  const searchValue = await withTimeout(async (signal) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error('Open VSX search is unavailable right now.')
    const bytes = await readCappedResponse(
      response,
      MAX_SEARCH_BYTES,
      'Open VSX returned an unexpectedly large response.',
    )
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      throw new Error('Open VSX returned an unreadable response.')
    }
  }, options.signal)

  if (!isRecord(searchValue) || !Array.isArray(searchValue.extensions)) {
    throw new Error('Open VSX returned an unreadable search response.')
  }

  const identities = searchValue.extensions.flatMap((candidate): Array<[string, string]> => {
    if (!isRecord(candidate)) return []
    const publisher = typeof candidate.namespace === 'string' ? candidate.namespace : ''
    const name = typeof candidate.name === 'string' ? candidate.name : ''
    return publisher && name ? [[publisher, name]] : []
  })

  const details = await Promise.allSettled(
    identities.slice(0, 16).map(([publisher, name]) =>
      withTimeout(async (signal) => {
        const detailUrl = `https://open-vsx.org/api/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`
        const response = await fetch(detailUrl, { signal })
        if (!response.ok) throw new Error('Open VSX theme details are unavailable.')
        const bytes = await readCappedResponse(
          response,
          MAX_DETAIL_BYTES,
          'Open VSX returned unexpectedly large theme details.',
        )
        const extension = extensionFromDetail(JSON.parse(new TextDecoder().decode(bytes)))
        if (!extension) return null

        const manifestResponse = await fetch(extension.manifestUrl, { signal })
        if (!manifestResponse.ok) throw new Error('Open VSX theme manifest is unavailable.')
        const manifestBytes = await readCappedResponse(
          manifestResponse,
          MAX_MANIFEST_BYTES,
          'Open VSX returned an unexpectedly large manifest.',
        )
        const manifest = parseJsoncObject(
          new TextDecoder().decode(manifestBytes),
          'Extension manifest',
        )
        return themeContributions(manifest).length > 0 &&
          manifestLicenseMatches(manifest, extension.license)
          ? extension
          : null
      }, options.signal),
    ),
  )

  if (options.signal?.aborted) options.signal.throwIfAborted()
  const completed = details.filter((result) => result.status === 'fulfilled')
  if (identities.length > 0 && completed.length === 0) {
    throw new Error('Open VSX theme details are unavailable right now.')
  }
  return completed.flatMap((result) => (result.value ? [result.value] : [])).slice(0, 8)
}

function normalizePackagePath(path: string, relativeTo = 'extension/'): string {
  if (
    path.length > MAX_PACKAGE_PATH_LENGTH ||
    path.includes('\0') ||
    path.startsWith('/') ||
    /^[a-z]:/i.test(path)
  ) {
    throw new Error('A theme path is not a safe relative package path.')
  }

  const segments = relativeTo.split('/').slice(0, -1)
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length <= 1) throw new Error('A theme path escapes the extension package.')
      segments.pop()
    } else {
      segments.push(segment)
    }
  }
  if (segments[0] !== 'extension') segments.unshift('extension')
  return segments.join('/')
}

function sanitizeTheme(value: Record<string, unknown>): Record<string, unknown> {
  const colors: Record<string, string> = {}
  if (isRecord(value.colors)) {
    for (const [key, color] of Object.entries(value.colors)) {
      if (USED_COLOR_KEYS.has(key) && typeof color === 'string' && color.length <= 128) {
        colors[key] = color
      }
    }
  }
  return {
    ...(typeof value.include === 'string' ? { include: value.include } : {}),
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.type === 'string' ? { type: value.type } : {}),
    colors,
  }
}

function inspectZipDirectory(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557)
  let endOffset = bytes.byteLength - 22

  while (
    endOffset >= minimumOffset &&
    (view.getUint32(endOffset, true) !== 0x06054b50 ||
      endOffset + 22 + view.getUint16(endOffset + 20, true) !== bytes.byteLength)
  ) {
    endOffset -= 1
  }
  if (endOffset < minimumOffset) throw new Error('The extension package has no ZIP directory.')

  const directorySize = view.getUint32(endOffset + 12, true)
  const directoryOffset = view.getUint32(endOffset + 16, true)
  const directoryEnd = directoryOffset + directorySize
  if (directoryEnd !== endOffset || directoryEnd > bytes.byteLength) {
    throw new Error('The extension package has an invalid ZIP directory.')
  }

  let entryCount = 0
  let totalUncompressed = 0
  let offset = directoryOffset
  while (offset < directoryEnd) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The extension package has an invalid ZIP directory.')
    }
    entryCount += 1
    if (entryCount > MAX_ZIP_ENTRIES) throw new Error('The extension package has too many files.')

    const compressed = view.getUint32(offset + 20, true)
    const uncompressed = view.getUint32(offset + 24, true)
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw new Error('The extension package uses unsupported ZIP64 metadata.')
    }
    totalUncompressed += uncompressed
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('The extension package expands beyond the safe import limit.')
    }
    if (
      uncompressed > 0 &&
      (compressed === 0 || uncompressed / compressed > MAX_COMPRESSION_RATIO)
    ) {
      throw new Error('The extension package has an unsafe compression ratio.')
    }

    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (offset !== directoryEnd)
    throw new Error('The extension package has an invalid ZIP directory.')

  if (view.getUint16(endOffset + 20, true) === 0) return bytes
  const withoutComment = bytes.slice(0, endOffset + 22)
  withoutComment[endOffset + 20] = 0
  withoutComment[endOffset + 21] = 0
  return withoutComment
}

function inspectZip(zip: JSZip): void {
  const entries = Object.values(zip.files) as InspectableZipObject[]
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error('The extension package has too many files.')
  for (const entry of entries) {
    if (entry.unsafeOriginalName) normalizePackagePath(entry.unsafeOriginalName)
  }
}

async function readZipText(zip: JSZip, path: string, description: string): Promise<string> {
  const file = zip.file(path) as InspectableZipObject | null
  if (!file) throw new Error(`${description} is missing from the extension package.`)
  if (typeof file._data?.uncompressedSize !== 'number') {
    throw new Error(`${description} has unreadable size metadata.`)
  }
  if (file._data.uncompressedSize > MAX_THEME_BYTES) throw new Error(`${description} is too large.`)
  return file.async('string')
}

async function loadThemeObject(
  zip: JSZip,
  path: string,
  cache: Map<string, Record<string, unknown>>,
  ancestors: ReadonlySet<string> = new Set(),
): Promise<Record<string, unknown>> {
  if (ancestors.size >= MAX_INCLUDE_DEPTH) throw new Error('Theme includes are nested too deeply.')
  if (ancestors.has(path)) throw new Error('Theme includes contain a cycle.')
  const cached = cache.get(path)
  if (cached) return cached

  const value = sanitizeTheme(parseJsoncObject(await readZipText(zip, path, path), path))
  if (typeof value.include !== 'string') {
    cache.set(path, value)
    return value
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(path)
  const base = await loadThemeObject(
    zip,
    normalizePackagePath(value.include, path),
    cache,
    nextAncestors,
  )
  const resolved = {
    ...base,
    ...value,
    colors: {
      ...(isRecord(base.colors) ? base.colors : {}),
      ...(isRecord(value.colors) ? value.colors : {}),
    },
  }
  cache.set(path, resolved)
  return resolved
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function importOpenVsxThemeExtension(
  extension: OpenVsxThemeExtension,
  options: { signal?: AbortSignal; onProgress?: (progress: ThemeImportProgress) => void } = {},
): Promise<InstalledTheme[]> {
  const { signal, onProgress } = options
  onProgress?.('manifest')
  const manifestResponse = await fetch(extension.manifestUrl, signal ? { signal } : {})
  if (!manifestResponse.ok) throw new Error('The Open VSX extension has no readable manifest.')
  const manifest = parseJsoncObject(
    new TextDecoder().decode(
      await readCappedResponse(
        manifestResponse,
        MAX_MANIFEST_BYTES,
        'The Open VSX extension manifest is too large.',
      ),
    ),
    'Extension manifest',
  )
  const advertisedThemes = themeContributions(manifest)
  if (advertisedThemes.length === 0) throw new Error('The extension does not contain color themes.')
  if (advertisedThemes.length > MAX_THEMES_PER_EXTENSION) {
    throw new Error('The extension contains too many color themes to import safely.')
  }
  if (
    !SUPPORTED_LICENSES.has(extension.license) ||
    !manifestLicenseMatches(manifest, extension.license)
  ) {
    throw new Error('The extension license is not eligible for import.')
  }

  onProgress?.('download')
  const packageResponse = await fetch(extension.downloadUrl, signal ? { signal } : {})
  if (!packageResponse.ok) throw new Error('The Open VSX theme could not be downloaded.')
  const packageBytes = await readCappedResponse(
    packageResponse,
    MAX_VSIX_BYTES,
    'The theme extension is too large to import safely.',
  )

  onProgress?.('verify')
  const checksumResponse = await fetch(extension.checksumUrl, signal ? { signal } : {})
  if (!checksumResponse.ok) throw new Error('The Open VSX theme has no readable checksum.')
  const expectedChecksum = new TextDecoder()
    .decode(await readCappedResponse(checksumResponse, 256, 'The checksum response is invalid.'))
    .trim()
    .split(/\s+/)[0]
  if (!expectedChecksum || !/^[a-f\d]{64}$/i.test(expectedChecksum)) {
    throw new Error('The Open VSX theme has an invalid checksum.')
  }
  if ((await digestHex(packageBytes)).toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error('The Open VSX theme failed its integrity check.')
  }

  onProgress?.('extract')
  signal?.throwIfAborted()
  let zip: JSZip
  try {
    const { default: JSZipLoader } = await import('jszip')
    zip = await JSZipLoader.loadAsync(inspectZipDirectory(packageBytes))
    inspectZip(zip)
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('The extension package')) throw cause
    throw new Error('The Open VSX extension package could not be opened.')
  }

  const packagedManifest = parseJsoncObject(
    await readZipText(zip, 'extension/package.json', 'Extension manifest'),
    'Extension manifest',
  )
  if (
    typeof packagedManifest.publisher !== 'string' ||
    packagedManifest.publisher.toLowerCase() !== extension.publisher.toLowerCase() ||
    typeof packagedManifest.name !== 'string' ||
    `${packagedManifest.publisher}.${packagedManifest.name}`.toLowerCase() !==
      extension.id.toLowerCase() ||
    packagedManifest.version !== extension.version
  ) {
    throw new Error('The extension package does not match the selected Open VSX theme.')
  }
  if (!manifestLicenseMatches(packagedManifest, extension.license)) {
    throw new Error('The extension package does not match its advertised license.')
  }

  const contributions = themeContributions(packagedManifest)
  if (contributions.length === 0 || contributions.length > MAX_THEMES_PER_EXTENSION) {
    throw new Error('The extension package has no safe color-theme collection.')
  }

  const collection: ThemeCollection = {
    id: extension.collectionId,
    label: extension.name.slice(0, 64),
    extensionId: extension.id,
    version: extension.version,
    license: extension.license,
  }
  const cache = new Map<string, Record<string, unknown>>()
  const themes: InstalledTheme[] = []
  for (const [index, contribution] of contributions.entries()) {
    signal?.throwIfAborted()
    if (typeof contribution.path !== 'string') {
      throw new Error('A color theme in the extension has no path.')
    }
    const path = normalizePackagePath(contribution.path)
    const theme = convertVsCodeTheme(await loadThemeObject(zip, path, cache), {
      id: themeId(extension.id, `${path}:${index}`),
      fallbackLabel: extension.name,
      contributionLabel: contribution.label,
      contributionType: contribution.uiTheme,
      collection,
    })
    themes.push(theme)
  }

  if (new Set(themes.map((theme) => theme.id)).size !== themes.length) {
    throw new Error('The extension contains duplicate color themes.')
  }
  return themes
}
