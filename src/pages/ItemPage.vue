<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { fetchItem } from '../api/hn'
import type { HnItem } from '../api/types'
import CommentNode from '../components/CommentNode.vue'
import { useOnline } from '../composables/useOnline'
import { hostFromUrl, pluralize, timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'

const route = useRoute()
const { online } = useOnline()

const id = computed(() => Number(route.params.id))

const story = ref<HnItem | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const itemsById = reactive(new Map<number, HnItem>())

const topCommentIds = computed(() => story.value?.kids ?? [])
const topLimit = ref(40)
const visibleTopIds = computed(() => topCommentIds.value.slice(0, topLimit.value))

let abort: AbortController | null = null

async function ensureItems(ids: number[]) {
  const uniques = Array.from(new Set(ids)).filter((n) => !itemsById.has(n))
  if (uniques.length === 0) return

  const results = await Promise.all(uniques.map(async (itemId) => await fetchItem(itemId)))
  for (const item of results) {
    if (!item || item.deleted || item.dead) continue
    itemsById.set(item.id, item)
  }
}

async function loadStory() {
  abort?.abort()
  abort = new AbortController()

  loading.value = true
  error.value = null
  story.value = null
  itemsById.clear()

  try {
    const item = await fetchItem(id.value, abort.signal)
    if (!item) throw new Error('Not found')
    story.value = item
    itemsById.set(item.id, item)

    topLimit.value = 40
    await ensureItems(visibleTopIds.value)
  } catch (e) {
    if (abort.signal.aborted) return
    error.value = e instanceof Error ? e.message : 'Failed to load item'
  } finally {
    if (!abort.signal.aborted) loading.value = false
  }
}

async function loadMoreTop() {
  if (visibleTopIds.value.length >= topCommentIds.value.length) return
  topLimit.value += 40
  await ensureItems(visibleTopIds.value)
}

const storyHost = computed(() => hostFromUrl(story.value?.url))
const storyText = computed(() => sanitizeHtml(story.value?.text))

watch(id, async () => {
  await loadStory()
})

onBeforeUnmount(() => {
  abort?.abort()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="page-header__row">
        <RouterLink class="btn btn--ghost" to="/">Back</RouterLink>
        <button class="btn btn--ghost" type="button" :disabled="loading" @click="loadStory">
          Refresh
        </button>
      </div>

      <div v-if="loading" class="muted">Loading…</div>
      <div v-else-if="!online" class="note">
        You’re offline. If you’ve opened this item before, cached content may still show.
      </div>
    </div>

    <div v-if="error" class="card">
      <div class="error-title">Couldn’t load</div>
      <div class="muted">{{ error }}</div>
      <div class="actions">
        <button class="btn" type="button" @click="loadStory">Try again</button>
      </div>
    </div>

    <article v-else-if="story" class="card">
      <h1 class="item-title">{{ story.title ?? 'Untitled' }}</h1>

      <div class="item-meta">
        <span v-if="story.score !== undefined">{{ story.score }} pts</span>
        <span v-if="story.by">by {{ story.by }}</span>
        <span v-if="story.time">{{ timeAgo(story.time) }}</span>
        <span v-if="storyHost">· {{ storyHost }}</span>
      </div>

      <div v-if="storyText" class="item-text" v-html="storyText" />

      <div class="actions">
        <a v-if="story.url" class="btn" :href="story.url" target="_blank" rel="noreferrer">Open link</a>
        <a
          class="btn btn--ghost"
          :href="`https://news.ycombinator.com/item?id=${story.id}`"
          target="_blank"
          rel="noreferrer"
        >
          Open on HN
        </a>
      </div>
    </article>

    <section v-if="story" class="stack">
      <div class="section-title">
        {{ topCommentIds.length }} {{ pluralize(topCommentIds.length, 'comment') }}
      </div>

      <div v-if="topCommentIds.length === 0" class="card muted">No comments.</div>

      <div v-else class="stack">
        <CommentNode
          v-for="commentId in visibleTopIds"
          :key="commentId"
          :id="commentId"
          :items-by-id="itemsById"
          :load-kids="ensureItems"
        />

        <button
          v-if="visibleTopIds.length < topCommentIds.length"
          class="btn"
          type="button"
          @click="loadMoreTop"
        >
          Load more
        </button>
      </div>
    </section>
  </div>
</template>
