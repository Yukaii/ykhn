export function isEditableElement(el: Element | null) {
  if (!el) return false

  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true

  if (el instanceof HTMLElement && el.isContentEditable) return true

  return false
}

export function shouldIgnoreKeyboardEvent(e: KeyboardEvent) {
  if (e.defaultPrevented) return true

  if (e.ctrlKey || e.metaKey || e.altKey) {
    // Still ignore if the user is typing in an input.
    if (isEditableElement(document.activeElement)) return true
    return false
  }

  // Ignore when typing into inputs/contenteditable.
  if (isEditableElement(document.activeElement)) return true
  if (e.target instanceof Element && isEditableElement(e.target)) return true

  return false
}

export function menuShortcutFromEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null

  if (/^F\d{1,2}$/.test(e.key)) return e.key
  if (e.key === 'PageDown') return 'PgDn'
  if (e.key === 'PageUp') return 'PgUp'

  return null
}

export function getMainScrollContainer(): HTMLElement | null {
  const el = document.querySelector('main')
  return el instanceof HTMLElement ? el : null
}
