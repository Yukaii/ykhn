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
  const el = document.querySelector('[data-ykhn-main]') ?? document.querySelector('main')
  return el instanceof HTMLElement ? el : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function scrollElementIntoMain(el: HTMLElement, block: ScrollLogicalPosition = 'nearest') {
  const container = getMainScrollContainer()
  if (!container) {
    el.scrollIntoView({ behavior: 'auto', block })
    return
  }

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()

  // Element top position in scroll coordinates of the container.
  const elTop = elRect.top - containerRect.top + container.scrollTop
  const elBottom = elTop + elRect.height

  const viewTop = container.scrollTop

  let targetTop = viewTop
  let resolvedBlock: ScrollLogicalPosition = block

  if (resolvedBlock === 'nearest') {
    if (elRect.top < containerRect.top) resolvedBlock = 'start'
    else if (elRect.bottom > containerRect.bottom) resolvedBlock = 'end'
    else return
  }

  if (resolvedBlock === 'start') {
    targetTop = elTop
  } else if (resolvedBlock === 'end') {
    targetTop = elBottom - container.clientHeight
  } else if (resolvedBlock === 'center') {
    targetTop = elTop - (container.clientHeight / 2 - elRect.height / 2)
  }

  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  container.scrollTop = clamp(targetTop, 0, maxTop)
}
