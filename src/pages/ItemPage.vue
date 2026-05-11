<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAsyncState, useEventListener, useSessionStorage } from '@vueuse/core'

import { fetchVoteActionsForItemPage, runHnProxyAction, type HnVoteAction } from '../api/auth'
import { fetchItem } from '../api/hn'
import type { HnItem } from '../api/types'
import CommentNode from '../components/CommentNode.vue'
import MobileThreadJoystick from '../components/MobileThreadJoystick.vue'
import { hostFromUrl, timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'
import {
  authState,
  setMenuActions,
  setMenuTitle,
  setLoading,
  setUpvotedItem,
  uiState,
} from '../store'
import {
  getMainScrollContainer,
  scrollElementIntoMain,
  shouldIgnoreKeyboardEvent,
} from '../lib/keyboard'
import { useHalfPageSelectionScrollComments } from '../composables/useHalfPageSelectionScrollComments'
import { useInfiniteScrollSentinel } from '../composables/useInfiniteScrollSentinel'

const route = useRoute()
const router = useRouter()

const id = computed(() => Number(route.params.id))
const itemsById = reactive(new Map<number, HnItem>())
const topLimit = ref(40)

const loadMoreSentinel = ref<HTMLElement | null>(null)
const loadingMoreTop = ref(false)
const loadingVoteActions = ref(false)
const voting = ref(false)
const voteActions = ref<HnVoteAction[]>([])
const voteActionsError = ref('')

type ItemViewState = {
  selectedCommentId: number | null
  selectionActive: boolean
  scrollTop: number
  topLimit: number
}

function stateKey(itemId: number) {
  return `ykhn:item:${itemId}`
}

const defaultItemViewState: ItemViewState = {
  selectedCommentId: null,
  selectionActive: true,
  scrollTop: 0,
  topLimit: 40,
}

function normalizeItemViewState(raw: unknown): ItemViewState {
  const st = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}

  const selectedCommentIdRaw = st.selectedCommentId
  const selectedCommentId =
    typeof selectedCommentIdRaw === 'number' && Number.isFinite(selectedCommentIdRaw)
      ? selectedCommentIdRaw
      : null

  const selectionActive = typeof st.selectionActive === 'boolean' ? st.selectionActive : true

  const scrollTop = Number(st.scrollTop)
  const resolvedScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0

  const rawTopLimit = Number(st.topLimit)
  const topLimit = Number.isFinite(rawTopLimit) && rawTopLimit >= 40 ? rawTopLimit : 40

  return { selectedCommentId, selectionActive, scrollTop: resolvedScrollTop, topLimit }
}

function parseJson(value: string | null) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const itemViewStates = new Map<number, ReturnType<typeof useSessionStorage<ItemViewState>>>()

function itemViewStateRef(itemId: number) {
  const existing = itemViewStates.get(itemId)
  if (existing) return existing

  const created = useSessionStorage<ItemViewState>(stateKey(itemId), defaultItemViewState, {
    serializer: {
      read: (v) => normalizeItemViewState(parseJson(v)),
      write: (v) => JSON.stringify(v),
    },
  })
  itemViewStates.set(itemId, created)
  return created
}

function saveViewState(itemId = id.value) {
  const main = getMainScrollContainer()
  itemViewStateRef(itemId).value = {
    selectedCommentId: selectedCommentId.value,
    selectionActive: selectionActive.value,
    scrollTop: main?.scrollTop ?? 0,
    topLimit: topLimit.value,
  }
}

function readViewState(itemId: number) {
  return itemViewStateRef(itemId).value
}

const {
  state: story,
  isLoading,
  error,
  execute: executeFetchStory,
} = useAsyncState(
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
  { immediate: false, shallow: true },
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

const canLoadMoreTop = computed(() => visibleTopIds.value.length < topCommentIds.value.length)
const isLoadingTop = computed(() => isLoading.value || loadingMoreTop.value)

onMounted(() => {
  void (async () => {
    await nextTick()
    useInfiniteScrollSentinel({
      target: loadMoreSentinel,
      canLoadMore: canLoadMoreTop,
      isLoading: isLoadingTop,
      onLoadMore: loadMoreTop,
      rootMargin: '400px',
    })
  })()
})

function hnItemUrl(itemId: number) {
  return `https://news.ycombinator.com/item?id=${itemId}`
}

function appItemUrl() {
  const href = router.resolve(route.fullPath).href
  if (typeof window === 'undefined') return href
  return new URL(href, window.location.origin).toString()
}

const voteActionById = computed(() => {
  const map = new Map<number, HnVoteAction>()
  for (const action of voteActions.value) {
    map.set(action.id, action)
  }
  return map
})

const selectedVoteTargetId = computed(() => selectedCommentId.value ?? story.value?.id ?? null)
const storyVoteLabel = computed(() => voteActionLabel(story.value?.id ?? null, 'Story'))
const selectedVoteLabel = computed(() => voteActionLabel(selectedVoteTargetId.value, 'Selected'))

function voteActionLabel(targetId: number | null, fallback: string) {
  if (targetId == null) return `Upvote ${fallback}`
  const action = voteActionById.value.get(targetId)
  const verb = action?.how === 'un' ? 'Unvote' : 'Upvote'
  return `${verb} ${fallback}`
}

function loginNextUrl() {
  return `/login?next=${encodeURIComponent(route.fullPath)}`
}

async function refreshVoteActions() {
  const token = authState.token
  if (!token || !story.value) {
    voteActions.value = []
    voteActionsError.value = ''
    return
  }

  loadingVoteActions.value = true
  voteActionsError.value = ''

  try {
    voteActions.value = await fetchVoteActionsForItemPage(id.value, token)
  } catch (e) {
    voteActions.value = []
    voteActionsError.value = e instanceof Error ? e.message : 'Unable to load login actions'
  } finally {
    loadingVoteActions.value = false
  }
}

async function toggleVote(targetId: number | null) {
  const token = authState.token
  if (!token) {
    router.push(loginNextUrl())
    return
  }

  if (targetId == null) return

  let action = voteActionById.value.get(targetId)
  if (!action && !loadingVoteActions.value) {
    await refreshVoteActions()
    action = voteActionById.value.get(targetId)
  }

  if (!action) {
    window.alert(voteActionsError.value || 'No vote action is available for this item.')
    return
  }

  voting.value = true
  setLoading(true)
  try {
    const nextVoted = action.how === 'up'
    await runHnProxyAction(action.href, token)
    setUpvotedItem(targetId, targetId === story.value?.id ? 'story' : 'comment', nextVoted)
    voteActions.value = voteActions.value.map((candidate) =>
      candidate.id === targetId ? { ...candidate, how: nextVoted ? 'un' : 'up' } : candidate,
    )
    await refreshVoteActions()
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Vote action failed')
  } finally {
    voting.value = false
    setLoading(false)
  }
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
    {
      label: authState.token ? storyVoteLabel.value : 'Login to Vote',
      action: () =>
        authState.token ? void toggleVote(story.value?.id ?? null) : router.push(loginNextUrl()),
      shortcut: 'v',
      disabled:
        !!authState.token &&
        (loadingVoteActions.value || voting.value || !voteActionById.value.has(id.value)),
    },
    {
      label: authState.token ? selectedVoteLabel.value : 'Login for Actions',
      action: () =>
        authState.token ? void toggleVote(selectedVoteTargetId.value) : router.push(loginNextUrl()),
      disabled:
        !!authState.token &&
        (selectedVoteTargetId.value == null ||
          loadingVoteActions.value ||
          voting.value ||
          !voteActionById.value.has(selectedVoteTargetId.value)),
    },
    {
      label: 'Refresh Login Actions',
      action: () => (authState.token ? void refreshVoteActions() : router.push(loginNextUrl())),
      disabled: !!authState.token && loadingVoteActions.value,
    },
    { label: 'Share (YKHN)', action: () => void shareOrCopy(appItemUrl(), { title: shareTitle }) },
    { label: 'Share (HN)', action: () => void shareOrCopy(hnUrl, { title: shareTitle }) },
    {
      label: 'Share (Link)',
      action: () => story.value?.url && void shareOrCopy(story.value.url, { title: shareTitle }),
      disabled: !story.value?.url,
    },
    {
      label: 'Open URL',
      action: () => story.value?.url && window.open(story.value.url, '_blank'),
      disabled: !story.value?.url,
    },
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

function findThreadRootIndex(els: HTMLElement[], fromIndex: number) {
  const start = Math.max(0, Math.min(els.length - 1, fromIndex))

  // If we're already on a top-level comment, that's the thread root.
  if (elementDepth(els[start] as HTMLElement) === 0) return start

  // Otherwise, walk up by scanning backward to the nearest depth==0.
  for (let i = start; i >= 0; i--) {
    const d = elementDepth(els[i] as HTMLElement)
    if (d === 0) return i
    // Depth < 0 means the story header card (not part of threads).
    if (d < 0) break
  }

  return -1
}

async function selectPrevThread() {
  if (!selectionActive.value) return
  const els = visibleCommentElements()
  if (els.length === 0) return

  const idx = currentCommentIndex()
  const rootIdx = findThreadRootIndex(els, idx)

  for (let i = (rootIdx >= 0 ? rootIdx : idx) - 1; i >= 0; i--) {
    if (elementDepth(els[i] as HTMLElement) === 0) {
      await selectCommentByIndex(i, { scroll: 'nearest' })
      return
    }
  }
}

async function selectNextThread() {
  if (!selectionActive.value) return
  const els = visibleCommentElements()
  if (els.length === 0) return

  const idx = currentCommentIndex()
  const rootIdx = findThreadRootIndex(els, idx)

  for (let i = (rootIdx >= 0 ? rootIdx : idx) + 1; i < els.length; i++) {
    if (elementDepth(els[i] as HTMLElement) === 0) {
      await selectCommentByIndex(i, { scroll: 'nearest' })
      return
    }
  }
}

function setSelectedCommentExpanded(expanded: boolean) {
  if (!selectionActive.value || selectedCommentId.value == null) return
  window.dispatchEvent(
    new CustomEvent('ykhn:comment-set-expanded', {
      detail: { id: selectedCommentId.value, expanded },
    }),
  )
}

async function selectFirstChildOfCurrent() {
  if (!selectionActive.value || selectedCommentId.value == null) return false

  const els = visibleCommentElements()
  if (els.length === 0) return false

  const idx = els.findIndex((el) => Number(el.dataset.ykhnCommentId) === selectedCommentId.value)
  if (idx < 0) return false

  const depth = elementDepth(els[idx] as HTMLElement)
  if (depth < 0) return false

  const childDepth = depth + 1

  for (let i = idx + 1; i < els.length; i++) {
    const d = elementDepth(els[i] as HTMLElement)
    if (d === childDepth) {
      await selectCommentByIndex(i, { scroll: 'nearest' })
      return true
    }
    if (d <= depth) return false
  }

  return false
}

async function loadSubEntriesFor(targetId: number, opts: { recursive: boolean }) {
  if (!selectionActive.value) return

  const item = itemsById.get(targetId)
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

let selectionScrollSeq = 0

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function selectCommentByIndex(idx: number, opts?: { scroll?: ScrollLogicalPosition }) {
  const els = visibleCommentElements()
  if (els.length === 0) return

  const clamped = Math.max(0, Math.min(els.length - 1, idx))
  const initialEl = els[clamped]
  if (!initialEl) return

  const nextId = Number(initialEl.dataset.ykhnCommentId)

  selectionActive.value = true
  selectedCommentId.value = Number.isFinite(nextId) ? nextId : null

  const seq = ++selectionScrollSeq

  await nextTick()
  if (seq !== selectionScrollSeq) return

  const root = getMainScrollContainer() ?? document
  const selector = `[data-ykhn-comment-id="${String(nextId)}"]`

  const resolvedInitial =
    root.querySelector<HTMLElement>(selector) ?? (initialEl.isConnected ? initialEl : null)
  if (resolvedInitial) {
    scrollElementIntoMain(resolvedInitial, opts?.scroll ?? 'nearest')

    await nextTick()
    await nextFrame()
    if (seq !== selectionScrollSeq) return

    const resolvedAfter =
      root.querySelector<HTMLElement>(selector) ??
      (resolvedInitial.isConnected ? resolvedInitial : null)
    if (resolvedAfter) scrollElementIntoMain(resolvedAfter, opts?.scroll ?? 'nearest')
  }

  saveViewState()
}

function parseCount(defaultCount: number) {
  const n = Number(countBuffer)
  countBuffer = ''
  if (!Number.isFinite(n) || n <= 0) return defaultCount
  return n
}

useHalfPageSelectionScrollComments({
  visibleCommentElements,
  currentCommentIndex,
  selectCommentByIndex: async (index) => {
    await selectCommentByIndex(index)
  },
})

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

  // Thread navigation (top-level comments).
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '{') {
    await selectPrevThread()
    e.preventDefault()
    return
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '}') {
    await selectNextThread()
    e.preventDefault()
    return
  }

  // Collapse selected comment.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'H') {
    setSelectedCommentExpanded(false)
    e.preventDefault()
    return
  }

  // Expand current comment, load sub-entries, then visit first child.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'l') {
    const targetId = selectedCommentId.value
    if (typeof targetId === 'number') {
      setSelectedCommentExpanded(true)
      await loadSubEntriesFor(targetId, { recursive: false })
      await nextTick()
      await selectFirstChildOfCurrent()
    }
    e.preventDefault()
    return
  }

  // Expand current comment, visit first child, and load descendants.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'L') {
    const targetId = selectedCommentId.value
    if (typeof targetId === 'number') {
      setSelectedCommentExpanded(true)
      await loadSubEntriesFor(targetId, { recursive: false })
      await nextTick()
      await selectFirstChildOfCurrent()
      void loadSubEntriesFor(targetId, { recursive: true })
    }
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

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'v') {
    await toggleVote(selectedVoteTargetId.value)
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

watch([id, story, visibleTopIds], () => {
  updateMenu()
})

watch([() => authState.token, id, story], () => {
  void refreshVoteActions()
})

watch([voteActions, loadingVoteActions, voting, selectedVoteTargetId], () => {
  updateMenu()
})

watch([selectedCommentId, selectionActive], () => {
  saveViewState()
})

useEventListener(window, 'keydown', onKeyDown)

onMounted(async () => {
  const restored = restoreFromState()
  await loadStory({ keepTopLimit: true })
  updateMenu()
  await applyRestoredScroll(restored)
  await ensureInitialCommentSelection()
})

onBeforeUnmount(() => {
  saveViewState()
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="error" class="tui-panel border-red-500">
      <div class="font-bold mb-2 uppercase">!! ACCESS DENIED !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" @click="() => loadStory()">RETRY</button>
    </div>

    <template v-else-if="story">
      <div
        class="tui-panel"
        :data-ykhn-comment-id="String(story.id)"
        :data-ykhn-depth="'-1'"
        :class="
          selectionActive && selectedCommentId === story.id
            ? 'border-tui-yellow bg-tui-active/10'
            : ''
        "
      >
        <h1 class="font-black mb-4 uppercase leading-tight text-tui-yellow text-xl md:text-2xl">
          <a
            v-if="story.url"
            :href="story.url"
            target="_blank"
            rel="noreferrer"
            class="hover:underline"
          >
            {{ story.title ?? 'UNTITLED' }}
          </a>
          <template v-else>{{ story.title ?? 'UNTITLED' }}</template>
        </h1>

        <div
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-2 mb-5 border-y border-tui-active/40 py-2 font-mono uppercase"
        >
          <div class="flex gap-1">
            <span class="text-tui-cyan">AUTHOR:</span
            ><span class="text-tui-text font-bold">{{ story.by }}</span>
          </div>
          <div class="flex gap-1">
            <span class="text-tui-cyan">SCORE:</span
            ><span class="text-tui-text font-bold">{{ story.score }}</span>
          </div>
          <div class="flex gap-1">
            <span class="text-tui-cyan">TIME:</span
            ><span class="text-tui-text font-bold">{{ timeAgo(story.time) }}</span>
          </div>
          <div v-if="storyHost" class="flex gap-1 truncate">
            <span class="text-tui-cyan">HOST:</span
            ><span class="text-tui-text font-bold truncate">{{ storyHost }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-4 font-mono uppercase">
          <button
            class="tui-btn"
            type="button"
            :disabled="
              !!authState.token && (loadingVoteActions || voting || !voteActionById.has(story.id))
            "
            @click="authState.token ? toggleVote(story.id) : router.push(loginNextUrl())"
          >
            {{ authState.token ? storyVoteLabel : 'LOGIN_TO_VOTE' }}
          </button>
          <span v-if="loadingVoteActions" class="text-tui-cyan">SYNCING_ACTIONS...</span>
          <span v-else-if="voteActionsError" class="text-red-300">{{ voteActionsError }}</span>
        </div>

        <div
          v-if="storyText"
          class="font-content border-l-4 border-tui-active pl-4 py-2 mb-2 bg-tui-active/10 break-words leading-relaxed prose prose-invert max-w-none"
          v-html="storyText"
        />
      </div>

      <div class="mt-6">
        <div class="tui-section-heading mb-4">>> COMMENTS_THREAD ({{ topCommentIds.length }})</div>

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

          <button
            v-if="visibleTopIds.length < topCommentIds.length"
            class="tui-btn w-full"
            @click="loadMoreTop"
          >
            LOAD_MORE_RECORDS
          </button>

          <div ref="loadMoreSentinel" class="h-2"></div>
        </div>
      </div>
    </template>

    <div v-else-if="isLoading" class="text-center py-20">
      <div>LOADING...</div>
      <div class="mt-2 text-tui-cyan">[▉▉▉▉▉▉▉▉▉▉ ]</div>
    </div>

    <MobileThreadJoystick />
  </div>
</template>
