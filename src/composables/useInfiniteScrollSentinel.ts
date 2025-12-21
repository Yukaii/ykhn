import { useIntersectionObserver } from '@vueuse/core'
import type { Ref } from 'vue'

import { getMainScrollContainer } from '../lib/keyboard'

type UseInfiniteScrollSentinelOptions = {
  target: Ref<HTMLElement | null>
  canLoadMore: Ref<boolean>
  isLoading: Ref<boolean>
  onLoadMore: () => void | Promise<void>
  root?: () => HTMLElement | null
  rootMargin?: string
}

export function useInfiniteScrollSentinel(opts: UseInfiniteScrollSentinelOptions) {
  useIntersectionObserver(
    opts.target,
    ([entry]) => {
      if (!entry?.isIntersecting) return
      if (!opts.canLoadMore.value) return
      if (opts.isLoading.value) return
      void opts.onLoadMore()
    },
    {
      root: (opts.root ? opts.root() : getMainScrollContainer()) ?? undefined,
      rootMargin: opts.rootMargin ?? '400px',
    }
  )
}
