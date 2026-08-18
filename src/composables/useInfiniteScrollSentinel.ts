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
      // Resolve the scroll container when VueUse starts observing (after the
      // template ref is mounted), rather than while setup is still rendering.
      root: () => opts.root?.() ?? getMainScrollContainer(),
      rootMargin: opts.rootMargin ?? '400px',
    },
  )
}
