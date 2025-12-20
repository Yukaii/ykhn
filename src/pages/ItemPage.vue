<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { fetchItem } from '../api/hn'
import type { HnItem } from '../api/types'
import CommentNode from '../components/CommentNode.vue'
import { hostFromUrl, timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'

const route = useRoute()

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

onMounted(async () => {
  await loadStory()
})

onBeforeUnmount(() => {
  abort?.abort()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000]">
      <div class="font-bold mb-2 uppercase">!! ACCESS DENIED !!</div>
      <div class="text-sm mb-4">{{ error }}</div>
      <button class="tui-btn" @click="loadStory">RETRY</button>
    </div>

    <template v-else-if="story">
      <div class="bg-tui-cyan text-tui-bg px-2 font-bold uppercase text-sm mb-2">
        FILE_CONTENT: {{ id }}.TXT
      </div>
      
      <div class="p-4 border-2 border-tui-border bg-tui-bg shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
        <h1 class="text-2xl md:text-3xl font-black mb-4 uppercase leading-tight text-tui-yellow">{{ story.title ?? 'UNTITLED' }}</h1>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[0.7rem] md:text-[0.75rem] mb-6 bg-tui-active/30 p-3 border border-tui-border/20 font-mono">
          <div class="flex gap-2"><span class="text-tui-cyan">AUTHOR:</span> <span class="font-bold">{{ story.by }}</span></div>
          <div class="flex gap-2"><span class="text-tui-cyan">SCORE:</span> <span class="font-bold">{{ story.score }} PTS</span></div>
          <div class="flex gap-2"><span class="text-tui-cyan">TIMESTAMP:</span> <span class="font-bold">{{ timeAgo(story.time).toUpperCase() }}</span></div>
          <div class="flex gap-2 truncate"><span class="text-tui-cyan">URL:</span> <span class="font-bold truncate">{{ storyHost || 'INTERNAL' }}</span></div>
        </div>

        <div v-if="storyText" class="font-content text-[0.9rem] md:text-[1rem] border-l-4 border-tui-active pl-4 py-2 mb-6 bg-tui-active/5 break-words leading-relaxed" v-html="storyText" />

        <div class="flex gap-4">
          <a v-if="story.url" class="tui-btn" :href="story.url" target="_blank" rel="noreferrer">OPEN_FILE</a>
          <button class="tui-btn bg-tui-active text-white" @click="loadStory">REFRESH</button>
        </div>
      </div>

      <div class="mt-6">
        <div class="bg-tui-active text-white px-2 font-bold uppercase text-sm mb-2">
          SUBDIRECTORY: {{ topCommentIds.length }} ENTRIES
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
          />

          <button
            v-if="visibleTopIds.length < topCommentIds.length"
            class="tui-btn w-full"
            @click="loadMoreTop"
          >
            LOAD_MORE_RECORDS
          </button>
        </div>
      </div>
    </template>
    
    <div v-else-if="loading" class="text-center py-20 animate-pulse">
      <div class="text-2xl">LOADING...</div>
      <div class="mt-2 text-tui-cyan">[▉▉▉▉▉▉▉▉▉▉      ]</div>
    </div>
  </div>
</template>
