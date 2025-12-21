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

type SelectionScrollDetail = {
  kind: 'halfPage'
  direction: 'up' | 'down'
  deltaPx: number
}

function dispatchSelectionScroll(detail: SelectionScrollDetail) {
  const ev = new CustomEvent<SelectionScrollDetail>('ykhn:selection-scroll', { detail, cancelable: true })
  const notCanceled = window.dispatchEvent(ev)
  return !notCanceled
}

export function useGlobalHotkeys() {
  const router = useRouter()

  let pendingGotoAt = 0

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
      const feeds = ['/', '/new', '/best', '/ask', '/show', '/jobs', '/search'] as const

      const map: Record<string, string> = {
        F1: '/',
        F2: '/new',
        F3: '/best',
        F4: '/ask',
        F5: '/show',
        F6: '/jobs',
        F7: '/search',
      }

      const to = map[e.key as keyof typeof map]
      if (to) {
        router.push(to)
        e.preventDefault()
        return
      }

      // Switch feeds with '[' / ']'. Only active on feed routes.
      if (e.key === '[' || e.key === ']') {
        const path = router.currentRoute.value.path
        const idx = feeds.indexOf(path as (typeof feeds)[number])
        if (idx >= 0) {
          const delta = e.key === '[' ? -1 : 1
          const nextIndex = (idx + delta + feeds.length) % feeds.length
          const nextPath = feeds[nextIndex] ?? feeds[0]
          router.push(nextPath)
          e.preventDefault()
          return
        }
      }

      if (e.key === 'F9') {
        router.push('/about')
        e.preventDefault()
        return
      }
    }

    // Go-to feed via 'g' + number (e.g. g1..g6).
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()

       if (pendingGotoAt && now - pendingGotoAt < 650 && /^[1-7]$/.test(e.key)) {
         const map: Record<string, string> = {
           '1': '/',
           '2': '/new',
           '3': '/best',
           '4': '/ask',
           '5': '/show',
           '6': '/jobs',
           '7': '/search',
         }

        router.push(map[e.key] as string)
        pendingGotoAt = 0
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (now - pendingGotoAt >= 650) pendingGotoAt = 0

      if (e.key === 'g') {
        pendingGotoAt = now
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
        if (dispatchSelectionScroll({ kind: 'halfPage', direction: 'down', deltaPx: page / 2 })) {
          e.preventDefault()
          return
        }
        if (scrollMainBy(page / 2)) e.preventDefault()
        return
      }
      if (e.key === 'u' && page) {
        if (dispatchSelectionScroll({ kind: 'halfPage', direction: 'up', deltaPx: -page / 2 })) {
          e.preventDefault()
          return
        }
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
