export function timeAgo(epochSeconds?: number) {
  if (!epochSeconds) return ''
  const diffMs = Date.now() - epochSeconds * 1000
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000))

  const minutes = Math.floor(diffSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (diffSeconds < 60) return `${diffSeconds}s`
  if (minutes < 60) return `${minutes}m`
  if (hours < 48) return `${hours}h`
  return `${days}d`
}

export function hostFromUrl(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function pluralize(n: number, singular: string, plural = `${singular}s`) {
  return n === 1 ? singular : plural
}
