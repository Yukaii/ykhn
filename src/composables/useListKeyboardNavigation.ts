import { nextTick, ref, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

import {
  focusWithoutScroll,
  isMenuElement,
  scrollElementIntoMain,
  shouldIgnoreKeyboardEvent,
} from '../lib/keyboard'
import { uiState } from '../store'

type MaybePromise<T> = T | Promise<T>

type UseListKeyboardNavigationOptions = {
  itemsLength: Readonly<Ref<number>>
  canLoadMore?: Readonly<Ref<boolean>>
  loadMore?: () => MaybePromise<void>
  onOpen?: (newTab: boolean) => MaybePromise<void>
  onOpenLink?: (newTab: boolean) => MaybePromise<void>
  onVote?: () => MaybePromise<void>
  canVote?: Readonly<Ref<boolean>>
}

export function useListKeyboardNavigation(options: UseListKeyboardNavigationOptions) {
  const selectedIndex = ref(0)
  const selectionActive = ref(true)
  const rowEls = ref<(HTMLElement | null)[]>([])

  let countBuffer = ''
  let pendingGAt = 0
  let pendingZAt = 0

  function clampIndex(i: number) {
    const last = options.itemsLength.value - 1
    if (last < 0) return 0
    return Math.max(0, Math.min(last, i))
  }

  async function scrollSelectedIntoView(block: ScrollLogicalPosition = 'nearest') {
    await nextTick()
    const el = rowEls.value[selectedIndex.value]
    if (!el) return
    scrollElementIntoMain(el, block)
    focusWithoutScroll(el)
  }

  function setSelected(i: number, opts?: { scroll?: ScrollLogicalPosition }) {
    selectionActive.value = true
    selectedIndex.value = clampIndex(i)
    if (opts?.scroll) void scrollSelectedIntoView(opts.scroll)
    else void scrollSelectedIntoView('nearest')
  }

  function resetSelection() {
    rowEls.value = []
    selectedIndex.value = 0
    selectionActive.value = true
  }

  function parseCount(defaultCount: number) {
    const n = Number(countBuffer)
    countBuffer = ''
    if (!Number.isFinite(n) || n <= 0) return defaultCount
    return n
  }

  async function onKeyDown(e: KeyboardEvent) {
    if (uiState.shortcutsOpen) return
    if (e.target instanceof Element && isMenuElement(e.target)) return
    if (shouldIgnoreKeyboardEvent(e)) return

    if (!e.ctrlKey && !e.metaKey && !e.altKey && /^\d$/.test(e.key)) {
      if (countBuffer.length === 0 && e.key === '0') return
      countBuffer += e.key
      e.preventDefault()
      return
    }

    const now = Date.now()

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'g') {
      const isDouble = now - pendingGAt < 650
      pendingGAt = now
      if (isDouble) setSelected(0, { scroll: 'start' })
      e.preventDefault()
      return
    }

    if (now - pendingGAt >= 650) pendingGAt = 0

    if (pendingZAt && now - pendingZAt < 650 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 't') {
        pendingZAt = 0
        void scrollSelectedIntoView('start')
        e.preventDefault()
        return
      }
      if (e.key === 'z') {
        pendingZAt = 0
        void scrollSelectedIntoView('center')
        e.preventDefault()
        return
      }
      if (e.key === 'b') {
        pendingZAt = 0
        void scrollSelectedIntoView('end')
        e.preventDefault()
        return
      }
    }

    if (now - pendingZAt >= 650) pendingZAt = 0

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'z') {
      pendingZAt = now
      e.preventDefault()
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'j') {
      const nextIndex = selectedIndex.value + parseCount(1)
      if (nextIndex >= options.itemsLength.value && options.canLoadMore?.value)
        await options.loadMore?.()
      setSelected(nextIndex)
      e.preventDefault()
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'k') {
      setSelected(selectedIndex.value - parseCount(1))
      e.preventDefault()
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'G') {
      const count = parseCount(options.itemsLength.value)
      const idx = Math.min(options.itemsLength.value - 1, Math.max(0, count - 1))
      setSelected(idx, { scroll: 'end' })
      e.preventDefault()
      return
    }

    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (e.key === 'Enter' || e.key === 'd' || e.key === 'D')
    ) {
      await options.onOpen?.(e.key === 'D')
      e.preventDefault()
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'o' || e.key === 'O')) {
      await options.onOpenLink?.(e.key === 'O')
      e.preventDefault()
      return
    }

    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key === 'v' &&
      (options.canVote?.value ?? true)
    ) {
      await options.onVote?.()
      e.preventDefault()
      return
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Escape') {
      selectionActive.value = false
      e.preventDefault()
    }
  }

  useEventListener(window, 'keydown', onKeyDown)

  return {
    selectedIndex,
    selectionActive,
    rowEls,
    resetSelection,
    scrollSelectedIntoView,
    setSelected,
  }
}
