<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAsyncState, useEventListener, useSessionStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'

import { searchStoryIds } from '../api/algolia'
import { fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import StoryRow from '../components/StoryRow.vue'
import {
  focusWithoutScroll,
  getMainScrollContainer,
  isMenuElement,
  scrollElementIntoMain,
  shouldIgnoreKeyboardEvent,
} from '../lib/keyboard'
import { useHalfPageSelectionScrollList } from '../composables/useHalfPageSelectionScrollList'
import { useInfiniteScrollSentinel } from '../composables/useInfiniteScrollSentinel'
import { setMenuActions, setMenuTitle, setLoading, uiState } from '../store'

const router = useRouter()
const route = useRoute()

const pageSize = 30

const inputEl = ref<HTMLInputElement | null>(null)
const query = ref('')
const submittedQuery = ref('')

const selectedIndex = ref(0)
const selectionActive = ref(true)
const rowEls = ref<(HTMLElement | null)[]>([])

const items = ref<HnItem[]>([])
const itemsError = ref<unknown>(null)

const searchPage = ref(0)
const nbPages = ref(0)

type SearchViewState = {
  page: number
  selectedIndex: number
  selectionActive: boolean
  scrollTop: number
}

function stateKey(q: string) {
  const normalized = q.trim().toLowerCase() || '__empty__'
  return `ykhn:search:${normalized}`
}

const defaultSearchViewState: SearchViewState = {
  page: 0,
  selectedIndex: 0,
  selectionActive: true,
  scrollTop: 0,
}

function normalizeSearchViewState(raw: unknown): SearchViewState {
  const st = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}

  const selectionActive = typeof st.selectionActive === 'boolean' ? st.selectionActive : true

  const scrollTop = Number(st.scrollTop)
  const resolvedScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0

  const rawPage = Number(st.page)
  const page = Number.isFinite(rawPage) ? Math.max(0, rawPage) : 0

  const rawSelectedIndex = Number(st.selectedIndex)
  const selectedIndex = Number.isFinite(rawSelectedIndex) ? Math.max(0, rawSelectedIndex) : 0

  return { page, selectedIndex, selectionActive, scrollTop: resolvedScrollTop }
}

function parseJson(value: string | null) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const searchViewStates = new Map<string, ReturnType<typeof useSessionStorage<SearchViewState>>>()

function searchViewStateRef(q: string) {
  const key = stateKey(q)
  const existing = searchViewStates.get(key)
  if (existing) return existing

  const created = useSessionStorage<SearchViewState>(key, defaultSearchViewState, {
    serializer: {
      read: (v) => normalizeSearchViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  })
  searchViewStates.set(key, created)
  return created
}

function saveViewState(q: string) {
  const main = getMainScrollContainer()
  searchViewStateRef(q).value = {
    page: searchPage.value,
    selectedIndex: selectedIndex.value,
    selectionActive: selectionActive.value,
    scrollTop: main?.scrollTop ?? 0,
  }
}

function normalizedViewState(q: string) {
  return searchViewStateRef(q).value
}

const loadingMore = ref(false)
const loadingItems = computed(() => loadingMore.value)

let seenIds = new Set<number>()
let searchAbort: AbortController | null = null

const canLoadMore = computed(() => {
  if (!submittedQuery.value) return false
  if (nbPages.value === 0) return true
  return searchPage.value < nbPages.value
})

const error = computed(() => itemsError.value)

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
  focusWithoutScroll(el)
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
  canLoadMore,
  isLoadingMore: loadingMore,
  loadMore,
  itemsError,
})

function selectedItem() {
  return items.value[selectedIndex.value]
}

function focusSearch() {
  inputEl.value?.focus()
  inputEl.value?.select()
}

async function loadMore() {
  if (loadingMore.value) return
  if (!canLoadMore.value) return

  loadingMore.value = true
  itemsError.value = null

  try {
    searchAbort?.abort()
    searchAbort = new AbortController()

    const { ids, nbPages: totalPages } = await searchStoryIds(submittedQuery.value, {
      page: searchPage.value,
      hitsPerPage: pageSize,
      signal: searchAbort.signal,
    })

    nbPages.value = totalPages
    searchPage.value += 1

    const nextIds = ids.filter((id) => !seenIds.has(id))
    for (const id of nextIds) seenIds.add(id)

    const next = await fetchItems(nextIds)
    items.value.push(...next)
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') itemsError.value = e
  } finally {
    loadingMore.value = false
  }
}

async function refresh() {
  items.value = []
  rowEls.value = []
  selectedIndex.value = 0
  selectionActive.value = true

  itemsError.value = null
  searchPage.value = 0
  nbPages.value = 0
  seenIds = new Set<number>()

  if (!submittedQuery.value) return
  await loadMore()
}

async function loadWithOptionalRestore(q: string) {
  const restored = normalizedViewState(q)

  items.value = []
  rowEls.value = []
  selectedIndex.value = 0
  selectionActive.value = restored.selectionActive

  itemsError.value = null
  searchPage.value = 0
  nbPages.value = 0
  seenIds = new Set<number>()

  if (!q) return

  const targetPages = Math.max(1, restored.page)
  const cappedTargetPages = Math.min(targetPages, 50)

  while (searchPage.value < cappedTargetPages) {
    await loadMore()
    if (itemsError.value) break
    if (!canLoadMore.value) break
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

async function submitSearch(nextQuery?: string) {
  const q = (nextQuery ?? query.value).trim()

  if (q) router.replace({ path: '/search', query: { q } })
  else router.replace({ path: '/search', query: {} })

  submittedQuery.value = q
  await refresh()
  if (q) setSelected(0, { scroll: 'start' })
}

function openComments(it: HnItem, newTab: boolean) {
  // Snapshot current list state so Back restores selection+scroll.
  saveViewState(submittedQuery.value)

  const resolved = router.resolve({ name: 'item', params: { id: it.id } })
  if (newTab) {
    window.open(resolved.href, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(resolved)
}

function openLink(it: HnItem, newTab: boolean) {
  // Snapshot current list state so Back restores selection+scroll.
  saveViewState(submittedQuery.value)

  if (!it?.url) {
    openComments(it, newTab)
    return
  }

  if (newTab) {
    window.open(it.url, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(it.url)
}

let countBuffer = ''
let pendingGAt = 0
let pendingZAt = 0

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

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/') {
    focusSearch()
    e.preventDefault()
    return
  }

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
    if (nextIndex >= items.value.length && canLoadMore.value) {
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
  const q = submittedQuery.value ? submittedQuery.value.toUpperCase() : 'EMPTY'
  setMenuTitle(`DIR: SEARCH\\Q=${q}`)
  setMenuActions([
    { label: 'Focus Search', action: focusSearch, shortcut: 'PgUp' },
    { label: 'Refresh', action: refresh, shortcut: 'r' },
    { label: 'Load More', action: loadMore, shortcut: 'PgDn', disabled: !canLoadMore.value },
  ])
}

const loadMoreSentinel = ref<HTMLElement | null>(null)

onMounted(() => {
  void (async () => {
    await nextTick()
    useInfiniteScrollSentinel({
      target: loadMoreSentinel,
      canLoadMore,
      isLoading: loadingMore,
      onLoadMore: loadMore,
      rootMargin: '400px',
    })
  })()
})

const { isLoading: loadingInit, execute: executeInit } = useAsyncState(
  async () => {
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    query.value = q
    submittedQuery.value = q
    await loadWithOptionalRestore(q.trim())
  },
  undefined,
  { immediate: false }
)

watch([loadingInit, loadingItems], ([l1, l2]) => {
  setLoading(l1 || l2)
})

watch([submittedQuery, canLoadMore], () => {
  updateMenu()
})

watch([selectedIndex, selectionActive], () => {
  saveViewState(submittedQuery.value)
})

watch(
  () => route.query.q,
  async (q) => {
    const next = typeof q === 'string' ? q : ''
    if (next.trim() === submittedQuery.value.trim()) return
    query.value = next
    submittedQuery.value = next
    await loadWithOptionalRestore(next.trim())
  }
)

useEventListener(window, 'keydown', onKeyDown)

onMounted(() => {
  updateMenu()
  void executeInit()
})

onBeforeUnmount(() => {
  saveViewState(submittedQuery.value)
  searchAbort?.abort()
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col h-full" role="listbox" aria-label="Search results">
    <form
      class="mb-2 flex flex-col md:flex-row gap-2 items-stretch md:items-center"
      @submit.prevent="submitSearch()"
    >
      <div class="flex-1 flex items-center gap-2">
        <label class="font-mono font-bold whitespace-nowrap" for="ykhn-search">SEARCH:</label>
        <input
          id="ykhn-search"
          ref="inputEl"
          v-model="query"
          class="flex-1 bg-tui-bg border-2 border-tui-border px-2 py-1 font-mono outline-none focus:border-tui-cyan"
          placeholder="Type query and press Enter"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          @keydown.enter.prevent="submitSearch()"
        />
      </div>

      <div class="flex gap-2">
        <button class="tui-btn" type="submit" :disabled="!query.trim()">SEARCH</button>
        <button class="tui-btn" type="button" @click="query = ''; submitSearch('')">CLEAR</button>
      </div>
    </form>

    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000] text-center">
      <div class="font-bold mb-2 uppercase">!! SEARCH ERROR !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" @click="refresh">RETRY</button>
    </div>

    <div v-else class="flex-1">
      <div v-if="submittedQuery && items.length === 0 && loadingItems" class="flex flex-col">
        <div v-for="n in 12" :key="n" class="p-2 border-b border-tui-active/30 flex gap-4 opacity-20">
          <div class="w-10 text-right">000</div>
          <div class="flex-1">
            <div class="bg-tui-text/20 h-4 w-3/4 mb-2"></div>
            <div class="bg-tui-text/20 h-3 w-1/2"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!submittedQuery" class="p-4 border border-tui-active/30 font-mono opacity-70">
        Type a query and press <span class="font-bold">Enter</span>. Press <span class="font-bold">/</span> to focus the search box.
      </div>

      <div v-else class="flex flex-col">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          :ref="(el: Element | ComponentPublicInstance | null) => (rowEls[idx] = el as HTMLElement | null)"
          role="option"
          tabindex="-1"
          :aria-selected="selectionActive && idx === selectedIndex"
          @click="setSelected(idx, { scroll: 'nearest' })"
        >
          <StoryRow :item="item" :selected="selectionActive && idx === selectedIndex" />
        </div>

        <div v-if="canLoadMore" class="mt-2">
          <button class="tui-btn w-full" :disabled="loadingItems" @click="loadMore">
            {{ loadingItems ? 'LOADING...' : 'LOAD_MORE_RECORDS' }}
          </button>
        </div>

        <div ref="loadMoreSentinel" class="h-2"></div>
      </div>
    </div>
  </div>
</template>
