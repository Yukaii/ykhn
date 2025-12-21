<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAsyncState } from '@vueuse/core'

import { fetchItem } from '../api/hn'
import type { HnItem } from '../api/types'
import CommentNode from '../components/CommentNode.vue'
import { hostFromUrl, timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'
import { setMenuActions, setMenuTitle, setLoading, uiState } from '../store'
import { getMainScrollContainer, scrollElementIntoMain, shouldIgnoreKeyboardEvent } from '../lib/keyboard'
import { readSessionJson, writeSessionJson } from '../lib/persist'

const route = useRoute()
const router = useRouter()

const id = computed(() => Number(route.params.id))
const itemsById = reactive(new Map<number, HnItem>())
const topLimit = ref(40)

const loadMoreSentinel = ref<HTMLElement | null>(null)
const loadMoreObserver = ref<IntersectionObserver | null>(null)
const loadingMoreTop = ref(false)

type ItemViewState = {
  selectedCommentId: number | null
  selectionActive: boolean
  scrollTop: number
  topLimit: number
}

function stateKey(itemId: number) {
  return `ykhn:item:${itemId}`
}

function saveViewState() {
  const main = getMainScrollContainer()
  const state: ItemViewState = {
    selectedCommentId: selectedCommentId.value,
    selectionActive: selectionActive.value,
    scrollTop: main?.scrollTop ?? 0,
    topLimit: topLimit.value,
  }
  writeSessionJson(stateKey(id.value), state)
}

function readViewState(itemId: number) {
  return readSessionJson<ItemViewState>(stateKey(itemId))
}

const { state: story, isLoading, error, execute: executeFetchStory } = useAsyncState(
  async () => {
    const item = await fetchItem(id.value)
    if (!item) throw new Error('Not found')
    itemsById.set(item.id, item)

    // Prefetch first batch of comments
    if (item.kids?.length) {
      await ensureItems(item.kids.slice(0, topLimit.value))
    }

    return item
  },
  null,
  { immediate: false, shallow: true }
)

const topCommentIds = computed(() => story.value?.kids ?? [])
const visibleTopIds = computed(() => topCommentIds.value.slice(0, topLimit.value))

async function ensureItems(ids: number[]) {
  const uniques = Array.from(new Set(ids)).filter((n) => !itemsById.has(n))
  if (uniques.length === 0) return

  const results = await Promise.all(uniques.map(async (itemId) => await fetchItem(itemId)))
  for (const item of results) {
    if (!item || item.deleted || item.dead) continue
    itemsById.set(item.id, item)
  }
}

async function loadStory(opts?: { keepTopLimit?: boolean }) {
  itemsById.clear()
  if (!opts?.keepTopLimit) topLimit.value = 40
  await executeFetchStory()
}

async function loadMoreTop() {
  if (loadingMoreTop.value) return
  if (visibleTopIds.value.length >= topCommentIds.value.length) return

  loadingMoreTop.value = true
  try {
    topLimit.value += 40
    await ensureItems(visibleTopIds.value)
    saveViewState()
  } finally {
    loadingMoreTop.value = false
  }
}

function teardownTopInfiniteScroll() {
  loadMoreObserver.value?.disconnect()
  loadMoreObserver.value = null
}

async function setupTopInfiniteScroll() {
  teardownTopInfiniteScroll()

  await nextTick()
  const root = getMainScrollContainer()
  if (!root || !loadMoreSentinel.value) return

  loadMoreObserver.value = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      if (isLoading.value) return
      void loadMoreTop()
    },
    {
      root,
      rootMargin: '400px',
    }
  )

  loadMoreObserver.value.observe(loadMoreSentinel.value)
}

function hnItemUrl(itemId: number) {
  return `https://news.ycombinator.com/item?id=${itemId}`
}

function appItemUrl() {
  const href = router.resolve(route.fullPath).href
  if (typeof window === 'undefined') return href
  return new URL(href, window.location.origin).toString()
}

async function shareOrCopy(url: string, opts?: { title?: string }) {
  const title = opts?.title

  // Prefer Web Share when available.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const data: ShareData = { url }
      if (title) data.title = title
      await navigator.share(data)
      return
    }
  } catch (e) {
    // Ignore user-cancel.
    if (e instanceof DOMException && e.name === 'AbortError') return
  }

  // Fallback: clipboard or prompt.
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      window.alert('Copied link to clipboard.')
      return
    }
  } catch {
    // ignore
  }

  window.prompt('Copy link:', url)
}

function updateMenu() {
  setMenuTitle(`FILE: ${id.value}.TXT`)

  const shareTitle = story.value?.title ?? `HN Item ${id.value}`
  const hnUrl = hnItemUrl(id.value)

  const actions = [
    { label: 'Refresh', action: () => loadStory({ keepTopLimit: true }), shortcut: 'r' },
    { label: 'Share (YKHN)', action: () => void shareOrCopy(appItemUrl(), { title: shareTitle }) },
    { label: 'Share (HN)', action: () => void shareOrCopy(hnUrl, { title: shareTitle }) },
    {
      label: 'Share (Link)',
      action: () => story.value?.url && void shareOrCopy(story.value.url, { title: shareTitle }),
      disabled: !story.value?.url,
    },
    { label: 'Open URL', action: () => story.value?.url && window.open(story.value.url, '_blank'), disabled: !story.value?.url },
    { label: 'View Source', action: () => window.open(hnUrl, '_blank') },
  ]

  if (visibleTopIds.value.length < topCommentIds.value.length) {
    actions.push({ label: 'Load More', action: loadMoreTop, shortcut: 'PgDn' })
  }
  setMenuActions(actions)
}

const storyHost = computed(() => hostFromUrl(story.value?.url))
const storyText = computed(() => sanitizeHtml(story.value?.text))

const selectedCommentId = ref<number | null>(null)
const selectionActive = ref(true)

let countBuffer = ''
let pendingGAt = 0
let pendingZAt = 0

function visibleCommentElements() {
  const root = getMainScrollContainer() ?? document
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-ykhn-comment-id]'))
  return nodes
}

function elementDepth(el: HTMLElement) {
  const d = Number(el.dataset.ykhnDepth)
  return Number.isFinite(d) ? d : 0
}

async function selectParent() {
  if (!selectionActive.value || selectedCommentId.value == null) return
  const els = visibleCommentElements()
  if (els.length === 0) return

  const idx = els.findIndex((el) => Number(el.dataset.ykhnCommentId) === selectedCommentId.value)
  if (idx <= 0) return

  const currentDepth = elementDepth(els[idx] as HTMLElement)
  const parentDepth = currentDepth - 1

  for (let i = idx - 1; i >= 0; i--) {
    if (elementDepth(els[i] as HTMLElement) === parentDepth) {
      await selectCommentByIndex(i, { scroll: 'nearest' })
      return
    }
  }
}

async function loadSubEntries(opts: { recursive: boolean }) {
  if (!selectionActive.value || selectedCommentId.value == null) return

  const item = itemsById.get(selectedCommentId.value)
  const kidIds = item?.kids ?? []
  if (!kidIds.length) return

  if (!opts.recursive) {
    await ensureItems(kidIds.slice(0, 200))
    return
  }


  // Breadth-first load descendants with a hard cap.
  const cap = 800
  const queue = [...kidIds]
  const seen = new Set<number>()

  while (queue.length && seen.size < cap) {
    const batch = queue.splice(0, 40)
    const uniques = batch.filter((n) => Number.isFinite(n) && !seen.has(n))
    if (uniques.length === 0) continue

    for (const n of uniques) {
      seen.add(n)
    }
    await ensureItems(uniques)

    for (const childId of uniques) {
      const child = itemsById.get(childId)
      if (child?.kids?.length) queue.push(...child.kids)
    }
  }
}

function currentCommentIndex() {
  const els = visibleCommentElements()
  if (els.length === 0) return -1
  if (!selectionActive.value || selectedCommentId.value == null) return 0

  const idx = els.findIndex((el) => Number(el.dataset.ykhnCommentId) === selectedCommentId.value)
  return idx >= 0 ? idx : 0
}

async function selectCommentByIndex(idx: number, opts?: { scroll?: ScrollLogicalPosition }) {
  const els = visibleCommentElements()
  if (els.length === 0) return

  const clamped = Math.max(0, Math.min(els.length - 1, idx))
  const el = els[clamped]
  if (!el) return

  const nextId = Number(el.dataset.ykhnCommentId)

  selectionActive.value = true
  selectedCommentId.value = Number.isFinite(nextId) ? nextId : null

  await nextTick()
  scrollElementIntoMain(el, opts?.scroll ?? 'nearest')
  saveViewState()
}

function parseCount(defaultCount: number) {
  const n = Number(countBuffer)
  countBuffer = ''
  if (!Number.isFinite(n) || n <= 0) return defaultCount
  return n
}

type SelectionScrollDetail = {
  kind: 'halfPage'
  direction: 'up' | 'down'
  deltaPx: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function halfPageCommentJumpCount(deltaPx: number) {
  const els = visibleCommentElements()
  if (els.length === 0) return 1

  const idx = clamp(currentCommentIndex(), 0, els.length - 1)
  const raw = els[idx]?.offsetHeight
  const px = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 60
  const rowPx = clamp(px, 24, 160)

  return Math.max(1, Math.floor(Math.abs(deltaPx) / rowPx))
}

function onSelectionScroll(ev: Event) {
  const e = ev as CustomEvent<SelectionScrollDetail>
  if (e.detail?.kind !== 'halfPage') return

  const els = visibleCommentElements()
  if (els.length === 0) return

  e.preventDefault()

  const main = getMainScrollContainer()
  main?.scrollBy({ top: e.detail.deltaPx, behavior: 'auto' })

  void (async () => {
    const direction = e.detail.direction === 'down' ? 1 : -1
    const targetIndex = currentCommentIndex() + direction * halfPageCommentJumpCount(e.detail.deltaPx)
    await selectCommentByIndex(targetIndex)
  })()
}

async function ensureInitialCommentSelection() {
  if (!selectionActive.value) return

  const els = visibleCommentElements()
  if (els.length === 0) {
    selectedCommentId.value = null
    return
  }

  if (selectedCommentId.value == null) {
    await selectCommentByIndex(0, { scroll: 'nearest' })
    return
  }

  const exists = els.some((el) => Number(el.dataset.ykhnCommentId) === selectedCommentId.value)
  if (!exists) {
    await selectCommentByIndex(0, { scroll: 'nearest' })
  }
}

function restoreFromState() {
  const st = readViewState(id.value)
  if (!st) return null

  topLimit.value = st.topLimit && st.topLimit >= 40 ? st.topLimit : 40
  selectedCommentId.value = st.selectedCommentId
  selectionActive.value = st.selectionActive
  return st
}

async function applyRestoredScroll(st: ItemViewState | null) {
  if (!st) return
  await nextTick()
  const main = getMainScrollContainer()
  if (!main) return
  main.scrollTop = st.scrollTop
  await nextTick()
  main.scrollTop = st.scrollTop
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
      await selectCommentByIndex(0, { scroll: 'start' })
    }
    e.preventDefault()
    return
  }

  if (now - pendingGAt >= 650) pendingGAt = 0

  if (pendingZAt && now - pendingZAt < 650 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 't') {
      pendingZAt = 0
      await selectCommentByIndex(currentCommentIndex(), { scroll: 'start' })
      e.preventDefault()
      return
    }
    if (e.key === 'z') {
      pendingZAt = 0
      await selectCommentByIndex(currentCommentIndex(), { scroll: 'center' })
      e.preventDefault()
      return
    }
    if (e.key === 'b') {
      pendingZAt = 0
      await selectCommentByIndex(currentCommentIndex(), { scroll: 'end' })
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

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'h') {
    await selectParent()
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'l') {
    await loadSubEntries({ recursive: false })
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'L') {
    await loadSubEntries({ recursive: true })
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'j') {
    await selectCommentByIndex(currentCommentIndex() + parseCount(1))
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'k') {
    await selectCommentByIndex(currentCommentIndex() - parseCount(1))
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'G') {
    const els = visibleCommentElements()
    if (els.length) {
      const count = parseCount(els.length)
      const idx = Math.min(els.length - 1, Math.max(0, count - 1))
      await selectCommentByIndex(idx, { scroll: 'end' })
      e.preventDefault()
    }
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'o' || e.key === 'O')) {
    const url = story.value?.url ?? hnItemUrl(id.value)
    saveViewState()

    if (e.key === 'O') {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.location.assign(url)
    }

    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Escape') {
    selectionActive.value = false
    saveViewState()
    e.preventDefault()
    return
  }
}

watch(isLoading, (l) => {
  setLoading(l)
})

watch([id, story, visibleTopIds], async () => {
  updateMenu()
  await setupTopInfiniteScroll()
})

watch([selectedCommentId, selectionActive], () => {
  saveViewState()
})

onMounted(async () => {
  const restored = restoreFromState()
  await loadStory({ keepTopLimit: true })
  updateMenu()
  await applyRestoredScroll(restored)
  await ensureInitialCommentSelection()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('ykhn:selection-scroll', onSelectionScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('ykhn:selection-scroll', onSelectionScroll)
  saveViewState()
  teardownTopInfiniteScroll()
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000]">
      <div class="font-bold mb-2 uppercase">!! ACCESS DENIED !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" @click="() => loadStory()">RETRY</button>
    </div>

    <template v-else-if="story">
      <div
        class="p-4 border-2 border-tui-border bg-tui-bg shadow-[4px_4px_0px_rgba(0,0,0,0.5)]"
        :data-ykhn-comment-id="String(story.id)"
        :data-ykhn-depth="'-1'"
        :class="selectionActive && selectedCommentId === story.id ? 'border-tui-yellow bg-tui-active/10' : ''"
      >
        <h1 class="font-black mb-4 uppercase leading-tight text-tui-yellow">
          <a v-if="story.url" :href="story.url" target="_blank" rel="noreferrer" class="hover:underline">
            {{ story.title ?? 'UNTITLED' }}
          </a>
          <template v-else>{{ story.title ?? 'UNTITLED' }}</template>
        </h1>

        <div class="flex flex-wrap gap-x-6 gap-y-2 mb-6 border-y border-tui-active/30 py-2 font-mono uppercase">
          <div class="flex gap-1"><span class="text-tui-cyan">AUTHOR:</span><span class="text-tui-text font-bold">{{ story.by }}</span></div>
          <div class="flex gap-1"><span class="text-tui-cyan">SCORE:</span><span class="text-tui-text font-bold">{{ story.score }}</span></div>
          <div class="flex gap-1"><span class="text-tui-cyan">TIME:</span><span class="text-tui-text font-bold">{{ timeAgo(story.time) }}</span></div>
          <div v-if="storyHost" class="flex gap-1 truncate"><span class="text-tui-cyan">HOST:</span><span class="text-tui-text font-bold truncate">{{ storyHost }}</span></div>
        </div>

        <div
          v-if="storyText"
          class="font-content border-l-4 border-tui-active pl-4 py-2 mb-2 bg-tui-active/5 break-words overflow-wrap-anywhere leading-relaxed prose prose-invert max-w-none"
          v-html="storyText"
        />
      </div>

      <div class="mt-6">
        <div class="bg-tui-active text-tui-text px-2 font-bold uppercase mb-4 border-b border-tui-border/30">
          >> COMMENTS_THREAD ({{ topCommentIds.length }})
        </div>

        <div v-if="topCommentIds.length === 0" class="text-center py-8 opacity-50 italic">
          -- EMPTY DIRECTORY --
        </div>

        <div v-else class="flex flex-col gap-4">
          <CommentNode
            v-for="commentId in visibleTopIds"
            :key="commentId"
            :id="commentId"
            :items-by-id="itemsById"
            :load-kids="ensureItems"
            :selected-id="selectionActive ? selectedCommentId : null"
          />

          <button v-if="visibleTopIds.length < topCommentIds.length" class="tui-btn w-full" @click="loadMoreTop">
            LOAD_MORE_RECORDS
          </button>

          <div ref="loadMoreSentinel" class="h-2"></div>
        </div>
      </div>
    </template>

    <div v-else-if="isLoading" class="text-center py-20">
      <div>LOADING...</div>
      <div class="mt-2 text-tui-cyan">[▉▉▉▉▉▉▉▉▉▉      ]</div>
    </div>
  </div>
</template>
