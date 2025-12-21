import { useEventListener } from '@vueuse/core'

import { getMainScrollContainer } from '../lib/keyboard'
import type { SelectionScrollDetail } from './useHalfPageSelectionScrollList'

type UseHalfPageSelectionScrollCommentsOptions = {
  visibleCommentElements: () => HTMLElement[]
  currentCommentIndex: () => number
  selectCommentByIndex: (index: number) => Promise<void>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function halfPageCommentJumpCount(deltaPx: number, getEls: () => HTMLElement[], getCurrentIndex: () => number) {
  const els = getEls()
  if (els.length === 0) return 1

  const idx = clamp(getCurrentIndex(), 0, els.length - 1)
  const raw = els[idx]?.offsetHeight
  const px = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 60
  const rowPx = clamp(px, 24, 160)

  return Math.max(1, Math.floor(Math.abs(deltaPx) / rowPx))
}

export function useHalfPageSelectionScrollComments(opts: UseHalfPageSelectionScrollCommentsOptions) {
  useEventListener(window, 'ykhn:selection-scroll', (ev) => {
    const e = ev as CustomEvent<SelectionScrollDetail>
    if (e.detail?.kind !== 'halfPage') return

    const els = opts.visibleCommentElements()
    if (els.length === 0) return

    e.preventDefault()

    const main = getMainScrollContainer()
    main?.scrollBy({ top: e.detail.deltaPx, behavior: 'auto' })

    void (async () => {
      const direction = e.detail.direction === 'down' ? 1 : -1
      const targetIndex =
        opts.currentCommentIndex() + direction * halfPageCommentJumpCount(e.detail.deltaPx, opts.visibleCommentElements, opts.currentCommentIndex)

      await opts.selectCommentByIndex(targetIndex)
    })()
  })
}
