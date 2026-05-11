<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import {
  fetchAuthList,
  type AuthCommentItem,
  type AuthListKind,
  type AuthSubmissionItem,
} from '../api/auth'
import StoryRow from '../components/StoryRow.vue'
import { timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'
import { authState, isItemUpvoted, setLoading, setMenuActions, setMenuTitle } from '../store'
import type { HnItem } from '../api/types'
import { useStoryVoteAction } from '../composables/useStoryVoteAction'
import { useListKeyboardNavigation } from '../composables/useListKeyboardNavigation'

const props = defineProps<{
  kind: AuthListKind
}>()

const router = useRouter()
const { toggleStoryVote, voteLabel, votingStoryId } = useStoryVoteAction()

const loading = ref(false)
const error = ref('')
const page = ref(1)
const nextPage = ref<number | null>(null)
const submissionItems = ref<AuthSubmissionItem[]>([])
const commentItems = ref<AuthCommentItem[]>([])

const isComments = computed(
  () =>
    props.kind === 'comments' ||
    props.kind === 'upvoted-comments' ||
    props.kind === 'favorites-comments',
)
const hasMore = computed(() => nextPage.value !== null)
const itemsLength = computed(() =>
  isComments.value ? commentItems.value.length : submissionItems.value.length,
)

const titleByKind: Record<AuthListKind, string> = {
  submissions: 'My Submissions',
  comments: 'My Comments',
  'upvoted-submissions': 'Upvoted Stories',
  'upvoted-comments': 'Upvoted Comments',
  'favorites-submissions': 'Favorite Stories',
  'favorites-comments': 'Favorite Comments',
}

const title = computed(() => titleByKind[props.kind])

function loginUrl() {
  return `/login?next=${encodeURIComponent(router.currentRoute.value.fullPath)}`
}

function submissionToHnItem(item: AuthSubmissionItem): HnItem {
  return {
    id: item.id,
    type: 'story',
    by: item.by ?? undefined,
    time: item.time ?? undefined,
    url: item.url.startsWith('item?') ? undefined : item.url,
    score: item.score ?? undefined,
    title: item.title,
    descendants: item.comments ?? undefined,
  }
}

function itemRouteFromUrl(url: string | null) {
  if (!url) return null
  const params = new URLSearchParams(url.split('?', 2)[1] ?? '')
  const id = Number(params.get('id'))
  return Number.isFinite(id) ? `/item/${id}` : null
}

function selectedSubmission() {
  return submissionItems.value[selectedIndex.value]
}

function selectedComment() {
  return commentItems.value[selectedIndex.value]
}

function selectedStoryItem() {
  const item = selectedSubmission()
  return item ? submissionToHnItem(item) : null
}

function selectedCommentRoute() {
  const item = selectedComment()
  return itemRouteFromUrl(item?.contextUrl ?? null) ?? itemRouteFromUrl(item?.parentUrl ?? null)
}

function openSelected(newTab: boolean) {
  if (isComments.value) {
    const route = selectedCommentRoute()
    if (!route) return
    if (newTab) window.open(router.resolve(route).href, '_blank', 'noopener,noreferrer')
    else router.push(route)
    return
  }

  const item = selectedSubmission()
  if (!item) return
  const route = `/item/${item.id}`
  if (newTab) window.open(router.resolve(route).href, '_blank', 'noopener,noreferrer')
  else router.push(route)
}

function openSelectedLink(newTab: boolean) {
  if (isComments.value) {
    openSelected(newTab)
    return
  }

  const item = selectedSubmission()
  if (!item) return

  if (!item.url || item.url.startsWith('item?')) {
    openSelected(newTab)
    return
  }

  if (newTab) window.open(item.url, '_blank', 'noopener,noreferrer')
  else window.location.assign(item.url)
}

async function load(targetPage: number) {
  const token = authState.token
  if (!token) {
    router.push(loginUrl())
    return
  }

  loading.value = true
  error.value = ''
  setLoading(true)

  try {
    const result = await fetchAuthList(props.kind, token, targetPage)
    page.value = result.page
    nextPage.value = result.nextPage

    if (isComments.value) {
      commentItems.value.push(...(result.items as AuthCommentItem[]))
    } else {
      submissionItems.value.push(...(result.items as AuthSubmissionItem[]))
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to load account list'
  } finally {
    loading.value = false
    setLoading(false)
  }
}

async function refresh() {
  page.value = 1
  nextPage.value = null
  submissionItems.value = []
  commentItems.value = []
  resetSelection()
  await load(1)
  await nextTick()
  setSelected(0, { scroll: 'start' })
}

async function loadMore() {
  if (!nextPage.value || loading.value) return
  await load(nextPage.value)
}

function updateMenu() {
  setMenuTitle(`DIR: AUTH\\${title.value.toUpperCase().replace(/ /g, '_')}`)
  setMenuActions([
    { label: 'Refresh', action: refresh, shortcut: 'r', disabled: loading.value },
    {
      label: 'Load More',
      action: loadMore,
      shortcut: 'PgDn',
      disabled: !hasMore.value || loading.value,
    },
    {
      label: 'Open',
      action: () => openSelected(false),
      shortcut: 'Enter',
      disabled: itemsLength.value === 0,
    },
    {
      label: 'Open New Tab',
      action: () => openSelected(true),
      shortcut: 'D',
      disabled: itemsLength.value === 0,
    },
    {
      label: isComments.value ? 'Vote Story' : voteLabel(selectedStoryItem()),
      action: () => !isComments.value && void toggleStoryVote(selectedStoryItem()),
      shortcut: 'v',
      disabled: isComments.value || itemsLength.value === 0 || !!votingStoryId.value,
    },
    { label: 'Login', action: () => router.push(loginUrl()), disabled: !!authState.token },
  ])
}

const { selectedIndex, selectionActive, rowEls, resetSelection, setSelected } =
  useListKeyboardNavigation({
    itemsLength,
    canLoadMore: hasMore,
    loadMore,
    onOpen: openSelected,
    onOpenLink: openSelectedLink,
    onVote: () => toggleStoryVote(selectedStoryItem()),
    canVote: computed(() => !isComments.value),
  })

watch(
  [
    title,
    hasMore,
    loading,
    selectedIndex,
    itemsLength,
    () => authState.token,
    () => authState.upvotedSubmissionIds,
    votingStoryId,
  ],
  updateMenu,
)

watch(
  () => props.kind,
  () => {
    void refresh()
  },
)

onMounted(() => {
  updateMenu()
  void refresh()
})

onBeforeUnmount(() => {
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="tui-section-heading">{{ title.toUpperCase() }}</div>

    <div v-if="!authState.token" class="tui-panel text-center">
      <div class="font-bold mb-3 uppercase">AUTH REQUIRED</div>
      <button class="tui-btn" type="button" @click="router.push(loginUrl())">LOGIN</button>
    </div>

    <div v-else-if="error" class="tui-panel border-red-500 text-center">
      <div class="font-bold mb-2 uppercase">!! AUTH API ERROR !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" type="button" @click="refresh">RETRY</button>
    </div>

    <template v-else>
      <div v-if="isComments" class="flex flex-col gap-3">
        <div
          v-for="(item, idx) in commentItems"
          :key="item.id"
          :ref="
            (el: Element | ComponentPublicInstance | null) =>
              (rowEls[idx] = el as HTMLElement | null)
          "
          class="tui-comment-card"
          :class="
            selectionActive && idx === selectedIndex
              ? 'border-2 border-tui-yellow bg-tui-active/10'
              : ''
          "
          role="option"
          tabindex="-1"
          :aria-selected="selectionActive && idx === selectedIndex"
          @click="setSelected(idx, { scroll: 'nearest' })"
        >
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 bg-tui-active/45 px-2 py-1.5 mb-3 font-mono border-b border-tui-border/20 uppercase"
          >
            <span class="text-tui-gray">USR:</span>
            <span class="text-tui-yellow font-bold">{{ item.by ?? authState.userId }}</span>
            <span class="text-tui-gray">DATE:</span>
            <span class="text-tui-cyan">{{
              item.time ? timeAgo(item.time).toUpperCase() : item.age
            }}</span>
            <span
              v-if="isItemUpvoted(item.id, 'comment')"
              class="tui-chip border-tui-yellow text-tui-yellow font-bold"
              >VOTED</span
            >
          </div>

          <RouterLink
            v-if="item.story?.id"
            class="block font-bold text-tui-yellow hover:underline mb-2"
            :to="`/item/${item.story.id}`"
          >
            {{ item.story.title ?? `ITEM_${item.story.id}` }}
          </RouterLink>

          <div
            class="prose prose-invert max-w-none font-content mb-3"
            v-html="sanitizeHtml(item.textHtml)"
          />

          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-if="itemRouteFromUrl(item.contextUrl)"
              class="tui-btn"
              :to="itemRouteFromUrl(item.contextUrl)!"
              >CONTEXT</RouterLink
            >
            <RouterLink
              v-if="itemRouteFromUrl(item.parentUrl)"
              class="tui-btn"
              :to="itemRouteFromUrl(item.parentUrl)!"
              >PARENT</RouterLink
            >
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col">
        <div
          v-for="(item, idx) in submissionItems"
          :key="item.id"
          :ref="
            (el: Element | ComponentPublicInstance | null) =>
              (rowEls[idx] = el as HTMLElement | null)
          "
          role="option"
          tabindex="-1"
          :aria-selected="selectionActive && idx === selectedIndex"
          @click="setSelected(idx, { scroll: 'nearest' })"
        >
          <StoryRow
            :item="submissionToHnItem(item)"
            :selected="selectionActive && idx === selectedIndex"
            :voted="isItemUpvoted(item.id)"
          />
        </div>
      </div>

      <div
        v-if="loading && submissionItems.length === 0 && commentItems.length === 0"
        class="text-center py-12"
      >
        <div>LOADING...</div>
        <div class="mt-2 text-tui-cyan">[▉▉▉▉▉▉▉▉▉▉ ]</div>
      </div>

      <button
        v-if="hasMore"
        class="tui-btn w-full"
        type="button"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? 'LOADING...' : 'LOAD_MORE_RECORDS' }}
      </button>

      <div
        v-if="!loading && !submissionItems.length && !commentItems.length"
        class="tui-panel-muted text-center opacity-80"
      >
        -- EMPTY DIRECTORY --
      </div>
    </template>
  </div>
</template>
