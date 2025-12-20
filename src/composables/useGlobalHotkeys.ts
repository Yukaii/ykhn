import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { menuState, setShortcutsOpen, toggleShortcuts, uiState } from '../store'
import { estimateRowScrollStepPx, getMainScrollContainer, menuShortcutFromEvent, shouldIgnoreKeyboardEvent } from '../lib/keyboard'

function runMenuActionByShortcut(shortcut: string) {
  const action = menuState.actions.find((a) => a.shortcut === shortcut && !a.disabled)
  if (!action) return false
  action.action()
  return true
}

function runMenuActionByLabel(label: string) {
  const action = menuState.actions.find((a) => a.label.toLowerCase() === label.toLowerCase() && !a.disabled)
  if (!action) return false
  action.action()
  return true
}

function scrollMainBy(deltaPx: number) {
  const el = getMainScrollContainer()
  if (!el) return false
  el.scrollBy({ top: deltaPx, behavior: 'auto' })
  return true
}

export function useGlobalHotkeys() {
  const router = useRouter()

  const onKeyDown = (e: KeyboardEvent) => {
    // Always allow closing overlays/menus.
    if (e.key === 'Escape') {
      const didCloseHelp = uiState.shortcutsOpen
      setShortcutsOpen(false)
      window.dispatchEvent(new CustomEvent('ykhn:close-menus'))
      if (didCloseHelp) e.preventDefault()
      return
    }

    if (e.key === '?' && !shouldIgnoreKeyboardEvent(e)) {
      toggleShortcuts()
      e.preventDefault()
      return
    }

    // If the help overlay is open, keep focus there.
    if (uiState.shortcutsOpen) return

    if (shouldIgnoreKeyboardEvent(e)) return

    // Feed navigation via function keys (mirrors the bottom bar).
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const map: Record<string, string> = {
        F1: '/',
        F2: '/new',
        F3: '/best',
        F4: '/ask',
        F5: '/show',
        F6: '/jobs',
      }

      const to = map[e.key as keyof typeof map]
      if (to) {
        router.push(to)
        e.preventDefault()
        return
      }

      if (e.key === 'F9') {
        router.push('/about')
        e.preventDefault()
        return
      }
    }

    // Global "menu actions" shortcuts.
    const shortcut = menuShortcutFromEvent(e)
    if (shortcut && runMenuActionByShortcut(shortcut)) {
      e.preventDefault()
      return
    }

    // Convenience: 'r' refreshes (same as F5).
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'r') {
      if (runMenuActionByLabel('Refresh')) {
        e.preventDefault()
      }
      return
    }

    // History navigation.
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
      if (e.key === 'o') {
        router.back()
        e.preventDefault()
        return
      }
      if (e.key === 'i') {
        router.forward()
        e.preventDefault()
        return
      }

      // Scrolling (vimify-hackernews style)
      const el = getMainScrollContainer()
      const page = el ? el.clientHeight : 0

      if (e.key === 'e') {
        const step = estimateRowScrollStepPx(el)
        if (scrollMainBy(step)) e.preventDefault()
        return
      }
      if (e.key === 'y') {
        const step = estimateRowScrollStepPx(el)
        if (scrollMainBy(-step)) e.preventDefault()
        return
      }

      if (e.key === 'd' && page) {
        if (scrollMainBy(page / 2)) e.preventDefault()
        return
      }
      if (e.key === 'u' && page) {
        if (scrollMainBy(-page / 2)) e.preventDefault()
        return
      }
      if (e.key === 'f' && page) {
        if (scrollMainBy(page)) e.preventDefault()
        return
      }
      if (e.key === 'b' && page) {
        if (scrollMainBy(-page)) e.preventDefault()
        return
      }

      if (e.key === 'r') {
        window.location.reload()
        e.preventDefault()
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown, true))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown, true))
}
