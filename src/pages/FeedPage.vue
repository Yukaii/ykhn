<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAsyncState, useEventListener, useSessionStorage } from '@vueuse/core'
import { useRouter } from 'vue-router'

import { fetchFeedIds, fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import type { FeedKind } from '../router'
import StoryRow from '../components/StoryRow.vue'
import { setMenuActions, setMenuTitle, setLoading, uiState } from '../store'
import { getMainScrollContainer, scrollElementIntoMain, shouldIgnoreKeyboardEvent } from '../lib/keyboard'
import { useHalfPageSelectionScrollList } from '../composables/useHalfPageSelectionScrollList'
import { useInfiniteScrollSentinel } from '../composables/useInfiniteScrollSentinel'

const props = defineProps<{
  feed: FeedKind
}>()

const router = useRouter()

const pageSize = 30

type FeedViewState = {
  cursor: number
  selectedIndex: number
  selectionActive: boolean
  scrollTop: number
}

function stateKey(feed: FeedKind) {
  return `ykhn:feed:${feed}`
}

const defaultFeedViewState: FeedViewState = {
  cursor: pageSize,
  selectedIndex: 0,
  selectionActive: true,
  scrollTop: 0,
}

function normalizeFeedViewState(raw: unknown): FeedViewState {
  const st = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}

  const selectionActive = typeof st.selectionActive === 'boolean' ? st.selectionActive : true

  const scrollTop = Number(st.scrollTop)
  const resolvedScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0

  const rawCursor = Number(st.cursor)
  const rawPage = Number(st.page)

  const cursor = Number.isFinite(rawCursor)
    ? Math.max(0, rawCursor)
    : Number.isFinite(rawPage)
      ? Math.max(1, rawPage) * pageSize
      : pageSize

  const rawSelectedIndex = Number(st.selectedIndex)
  const baseSelectedIndex = Number.isFinite(rawSelectedIndex) ? rawSelectedIndex : 0

  const selectedIndex = Number.isFinite(rawCursor)
    ? Math.max(0, baseSelectedIndex)
    : Number.isFinite(rawPage)
      ? Math.max(0, (Math.max(1, rawPage) - 1) * pageSize + baseSelectedIndex)
      : Math.max(0, baseSelectedIndex)

  return {
    cursor,
    selectedIndex,
    selectionActive,
    scrollTop: resolvedScrollTop,
  }
}

function parseJson(value: string | null) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const feedViewStates = {
  top: useSessionStorage<FeedViewState>(stateKey('top'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
  new: useSessionStorage<FeedViewState>(stateKey('new'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
  best: useSessionStorage<FeedViewState>(stateKey('best'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
  ask: useSessionStorage<FeedViewState>(stateKey('ask'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
  show: useSessionStorage<FeedViewState>(stateKey('show'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
  jobs: useSessionStorage<FeedViewState>(stateKey('jobs'), defaultFeedViewState, {
    serializer: {
      read: (v) => normalizeFeedViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  }),
} satisfies Record<FeedKind, ReturnType<typeof useSessionStorage<FeedViewState>>>

function saveViewState(feed: FeedKind) {
  const main = getMainScrollContainer()
  feedViewStates[feed].value = {
    cursor: cursor.value,
    selectedIndex: selectedIndex.value,
    selectionActive: selectionActive.value,
    scrollTop: main?.scrollTop ?? 0,
  }
}

function normalizedViewState(feed: FeedKind) {
  return feedViewStates[feed].value
}

const feedTitle: Record<FeedKind, string> = {
  top: 'Top',
  new: 'New',
  best: 'Best',
  ask: 'Ask',
  show: 'Show',
  jobs: 'Jobs',
}

const title = computed(() => feedTitle[props.feed])

const selectedIndex = ref(0)
const selectionActive = ref(true)
const rowEls = ref<(HTMLElement | null)[]>([])

const cursor = ref(0)
const loadingMore = ref(false)

let countBuffer = ''
let pendingGAt = 0
let pendingZAt = 0

const loadMoreSentinel = ref<HTMLElement | null>(null)

const { state: ids, isLoading: loadingIds, error: idsError, execute: executeLoadIds } = useAsyncState(
  async () => {
    return await fetchFeedIds(props.feed)
  },
  [],
  { immediate: false, shallow: true }
)

const items = ref<HnItem[]>([])
const itemsError = ref<unknown>(null)

const hasMore = computed(() => cursor.value < ids.value.length)
const loadingItems = computed(() => loadingMore.value)

const error = computed(() => idsError.value || itemsError.value)

function clampIndex(i: number) {
  const last = items.value.length - 1
  if (last < 0) return 0
  return Math.max(0, Math.min(last, i))
}

async function scrollSelectedIntoView(block: ScrollLogicalPosition = 'nearest') {
  await nextTick()
  const el = rowEls.value[selectedIndex.value]
  if (!el) return
  scrollElementIntoMain(el, block)
}

function setSelected(i: number, opts?: { scroll?: ScrollLogicalPosition }) {
  selectionActive.value = true
  selectedIndex.value = clampIndex(i)
  if (opts?.scroll) void scrollSelectedIntoView(opts.scroll)
  else void scrollSelectedIntoView('nearest')
}

useHalfPageSelectionScrollList({
  itemsLength: computed(() => items.value.length),
  selectedIndex,
  setSelected: (index) => setSelected(index),
  canLoadMore: hasMore,
  isLoadingMore: loadingMore,
  loadMore,
  itemsError,
})

function selectedItem() {
  return items.value[selectedIndex.value]
}

async function loadMore() {
  if (loadingMore.value) return
  if (!hasMore.value) return

  loadingMore.value = true
  itemsError.value = null

  try {
    const slice = ids.value.slice(cursor.value, cursor.value + pageSize)
    cursor.value += slice.length

    const next = await fetchItems(slice)
    items.value.push(...next)
  } catch (e) {
    itemsError.value = e
  } finally {
    loadingMore.value = false
  }
}

async function refresh() {
  await executeLoadIds()
  items.value = []
  rowEls.value = []
  cursor.value = 0
  selectedIndex.value = 0
  selectionActive.value = true
  await loadMore()
  saveViewState(props.feed)
}

function openComments(it: HnItem, newTab: boolean) {
  // Snapshot current list state so Back restores selection+scroll.
  saveViewState(props.feed)

  const resolved = router.resolve({ name: 'item', params: { id: it.id } })
  if (newTab) {
    window.open(resolved.href, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(resolved)
}

function openLink(it: HnItem, newTab: boolean) {
  if (!it?.url) {
    openComments(it, newTab)
    return
  }

  if (newTab) {
    window.open(it.url, '_blank', 'noopener,noreferrer')
    return
  }

  // Leaving the SPA: persist state first.
  saveViewState(props.feed)
  window.location.assign(it.url)
}

function parseCount(defaultCount: number) {
  const n = Number(countBuffer)
  countBuffer = ''
  if (!Number.isFinite(n) || n <= 0) return defaultCount
  return n
}


async function onKeyDown(e: KeyboardEvent) {
  if (uiState.shortcutsOpen) return
  if (shouldIgnoreKeyboardEvent(e)) return

  // Count prefix: <num>j / <num>k / <num>G
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
    if (isDouble) {
      setSelected(0, { scroll: 'start' })
    }
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
    if (nextIndex >= items.value.length && hasMore.value) {
      await loadMore()
    }
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
    const count = parseCount(items.value.length)
    const idx = Math.min(items.value.length - 1, Math.max(0, count - 1))
    setSelected(idx, { scroll: 'end' })
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Enter' || e.key === 'd' || e.key === 'D')) {
    const it = selectedItem()
    if (it) openComments(it, e.key === 'D')
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'o' || e.key === 'O')) {
    const it = selectedItem()
    if (it) openLink(it, e.key === 'O')
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Escape') {
    selectionActive.value = false
    e.preventDefault()
    return
  }
}

function updateMenu() {
  setMenuTitle(`DIR: ${title.value.toUpperCase()}\\*.*`)
  setMenuActions([
    { label: 'Refresh', action: refresh, shortcut: 'r' },
    { label: 'Load More', action: loadMore, shortcut: 'PgDn', disabled: !hasMore.value },
  ])
}

onMounted(() => {
  void (async () => {
    await nextTick()
    useInfiniteScrollSentinel({
      target: loadMoreSentinel,
      canLoadMore: hasMore,
      isLoading: loadingMore,
      onLoadMore: loadMore,
      rootMargin: '400px',
    })
  })()
})

async function loadWithOptionalRestore(feed: FeedKind) {
  const restored = normalizedViewState(feed)

  items.value = []
  rowEls.value = []
  cursor.value = 0
  selectedIndex.value = 0
  selectionActive.value = restored.selectionActive

  await executeLoadIds()

  const targetCursor = Math.min(restored.cursor, ids.value.length)
  while (cursor.value < targetCursor) {
    await loadMore()
  }

  await nextTick()
  const main = getMainScrollContainer()
  if (main) {
    main.scrollTop = restored.scrollTop
    await nextTick()
    main.scrollTop = restored.scrollTop
  }

  if (selectionActive.value) {
    selectedIndex.value = clampIndex(restored.selectedIndex)
    await scrollSelectedIntoView('nearest')
  }
}

watch([loadingIds, loadingItems], ([l1, l2]) => {
  setLoading(l1 || l2)
})

watch([() => props.feed, hasMore, title], () => {
  updateMenu()
})

watch([selectedIndex, selectionActive], () => {
  saveViewState(props.feed)
})

watch(
  () => props.feed,
  async (nextFeed, prevFeed) => {
    if (prevFeed) saveViewState(prevFeed)
    await loadWithOptionalRestore(nextFeed)
  },
  { immediate: true }
)


useEventListener(window, 'keydown', onKeyDown)

onMounted(() => {
  updateMenu()
})

onBeforeUnmount(() => {
  saveViewState(props.feed)
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col h-full" role="listbox" aria-label="Stories">
    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000] text-center">
      <div class="font-bold mb-2 uppercase">!! DISK READ ERROR !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" @click="refresh">RETRY</button>
    </div>

    <div v-else class="flex-1">
      <div v-if="loadingItems && items.length === 0" class="flex flex-col">
        <div v-for="n in 15" :key="n" class="p-2 border-b border-tui-active/30 flex gap-4 opacity-20">
          <div class="w-10 text-right">000</div>
          <div class="flex-1">
            <div class="bg-tui-text/20 h-4 w-3/4 mb-2"></div>
            <div class="bg-tui-text/20 h-3 w-1/2"></div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          :ref="(el: Element | ComponentPublicInstance | null) => (rowEls[idx] = el as HTMLElement | null)"
          role="option"
          :aria-selected="selectionActive && idx === selectedIndex"
          @click="setSelected(idx, { scroll: 'nearest' })"
        >
          <StoryRow :item="item" :selected="selectionActive && idx === selectedIndex" />
        </div>

        <div v-if="hasMore" class="mt-2">
          <button class="tui-btn w-full" :disabled="loadingItems" @click="loadMore">
            {{ loadingItems ? 'LOADING...' : 'LOAD_MORE_RECORDS' }}
          </button>
        </div>

        <div ref="loadMoreSentinel" class="h-2"></div>
      </div>
    </div>
  </div>
</template>
