import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

import { estimateRowScrollStepPx, getMainScrollContainer } from '../lib/keyboard'

export type SelectionScrollDetail = {
  kind: 'halfPage'
  direction: 'up' | 'down'
  deltaPx: number
}

type UseHalfPageSelectionScrollListOptions = {
  itemsLength: Ref<number>
  selectedIndex: Ref<number>
  setSelected: (index: number) => void

  canLoadMore: Ref<boolean>
  isLoadingMore: Ref<boolean>
  loadMore: () => void | Promise<void>
  itemsError: Ref<unknown>
}

function halfPageRowJumpCount(deltaPx: number) {
  const main = getMainScrollContainer()
  const rowPx = estimateRowScrollStepPx(main)
  const raw = Math.floor(Math.abs(deltaPx) / rowPx)
  return Math.max(1, raw)
}

export function useHalfPageSelectionScrollList(opts: UseHalfPageSelectionScrollListOptions) {
  useEventListener(window, 'ykhn:selection-scroll', (ev) => {
    const e = ev as CustomEvent<SelectionScrollDetail>
    if (e.detail?.kind !== 'halfPage') return
    if (opts.itemsLength.value === 0) return

    e.preventDefault()

    const main = getMainScrollContainer()
    main?.scrollBy({ top: e.detail.deltaPx, behavior: 'auto' })

    void (async () => {
      const direction = e.detail.direction === 'down' ? 1 : -1
      const targetIndex = opts.selectedIndex.value + direction * halfPageRowJumpCount(e.detail.deltaPx)

      if (direction > 0) {
        while (targetIndex >= opts.itemsLength.value && opts.canLoadMore.value) {
          if (opts.isLoadingMore.value) break
          await opts.loadMore()
          if (opts.itemsError.value) break
        }
      }

      opts.setSelected(targetIndex)
    })()
  })
}
