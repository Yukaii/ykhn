export function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function readSessionJson<T>(key: string): T | null {
  return safeJsonParse<T>(sessionStorage.getItem(key))
}

export function writeSessionJson<T>(key: string, value: T) {
  sessionStorage.setItem(key, JSON.stringify(value))
}
