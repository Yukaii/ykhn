<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAsyncState } from '@vueuse/core'
import { useRouter } from 'vue-router'

import { fetchFeedIds, fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import type { FeedKind } from '../router'
import StoryRow from '../components/StoryRow.vue'
import { setMenuActions, setMenuTitle, setLoading, uiState } from '../store'
import { getMainScrollContainer, scrollElementIntoMain, shouldIgnoreKeyboardEvent } from '../lib/keyboard'
import { readSessionJson, writeSessionJson } from '../lib/persist'

const props = defineProps<{
  feed: FeedKind
}>()

const router = useRouter()

type FeedViewState = {
  page: number
  selectedIndex: number
  selectionActive: boolean
  scrollTop: number
}

function stateKey(feed: FeedKind) {
  return `ykhn:feed:${feed}`
}

function saveViewState(feed: FeedKind) {
  const main = getMainScrollContainer()
  const state: FeedViewState = {
    page: page.value,
    selectedIndex: selectedIndex.value,
    selectionActive: selectionActive.value,
    scrollTop: main?.scrollTop ?? 0,
  }
  writeSessionJson(stateKey(feed), state)
}

function readViewState(feed: FeedKind) {
  return readSessionJson<FeedViewState>(stateKey(feed))
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
const page = ref(1)
const pageSize = 30

const selectedIndex = ref(0)
const selectionActive = ref(true)
const rowEls = ref<(HTMLElement | null)[]>([])

let suppressPageWatch = false
let restoring = false

let countBuffer = ''
let pendingGAt = 0
let pendingZAt = 0

const { state: ids, isLoading: loadingIds, error: idsError, execute: executeLoadIds } = useAsyncState(
  async () => {
    return await fetchFeedIds(props.feed)
  },
  [],
  { immediate: false, shallow: true }
)

const { state: items, isLoading: loadingItems, error: itemsError, execute: executeLoadItems } = useAsyncState(
  async () => {
    if (ids.value.length === 0) return []
    const start = (page.value - 1) * pageSize
    const slice = ids.value.slice(start, start + pageSize)
    return await fetchItems(slice)
  },
  [],
  { immediate: false, shallow: true }
)

const error = computed(() => idsError.value || itemsError.value)

const totalPages = computed(() => Math.max(1, Math.ceil(ids.value.length / pageSize)))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

async function refresh() {
  await executeLoadIds()
  await executeLoadItems()
}

function next() {
  if (!canNext.value) return
  selectionActive.value = true
  selectedIndex.value = 0
  page.value++
}

function prev() {
  if (!canPrev.value) return
  selectionActive.value = true
  selectedIndex.value = 0
  page.value--
}

function updateMenu() {
  setMenuTitle(`DIR: ${title.value.toUpperCase()}\\*.*`)
  setMenuActions([
    { label: 'Refresh', action: refresh, shortcut: 'r' },
    { label: 'Next Page', action: next, shortcut: 'PgDn', disabled: !canNext.value },
    { label: 'Prev Page', action: prev, shortcut: 'PgUp', disabled: !canPrev.value },
  ])
}

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

function selectedItem() {
  return items.value[selectedIndex.value]
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

function onKeyDown(e: KeyboardEvent) {
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
    setSelected(selectedIndex.value + parseCount(1))
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

async function loadWithOptionalRestore(feed: FeedKind) {
  restoring = true

  const restored = readViewState(feed)
  suppressPageWatch = true
  page.value = restored?.page && restored.page >= 1 ? restored.page : 1
  selectedIndex.value = restored?.selectedIndex ?? 0
  selectionActive.value = restored?.selectionActive ?? true
  suppressPageWatch = false

  await refresh()

  await nextTick()
  const main = getMainScrollContainer()
  if (main && restored) {
    main.scrollTop = restored.scrollTop
  }

  if (selectionActive.value) {
    setSelected(selectedIndex.value)
  }

  restoring = false
}

watch([loadingIds, loadingItems], ([l1, l2]) => {
  setLoading(l1 || l2)
})

watch([() => props.feed, canNext, canPrev, title], () => {
  updateMenu()
})

watch(page, async () => {
  if (suppressPageWatch) return
  await executeLoadItems()
  saveViewState(props.feed)
})

watch(
  () => items.value.length,
  () => {
    rowEls.value = []
    if (restoring) return
    setSelected(0, { scroll: 'start' })
  }
)

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

onMounted(() => {
  updateMenu()
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
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
      </div>
    </div>
  </div>
</template>
