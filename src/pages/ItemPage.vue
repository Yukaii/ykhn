<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAsyncState } from '@vueuse/core'

import { fetchItem } from '../api/hn'
import type { HnItem } from '../api/types'
import CommentNode from '../components/CommentNode.vue'
import { hostFromUrl, timeAgo } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'
import { setMenuActions, setMenuTitle, setLoading } from '../store'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const itemsById = reactive(new Map<number, HnItem>())
const topLimit = ref(40)

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

async function loadStory() {
  itemsById.clear()
  topLimit.value = 40
  await executeFetchStory()
}

async function loadMoreTop() {
  if (visibleTopIds.value.length >= topCommentIds.value.length) return
  topLimit.value += 40
  await ensureItems(visibleTopIds.value)
}

function updateMenu() {
  setMenuTitle(`FILE: ${id.value}.TXT`)
  const actions = [
    { label: 'Refresh', action: loadStory, shortcut: 'F5' },
    { label: 'Open URL', action: () => story.value?.url && window.open(story.value.url, '_blank'), disabled: !story.value?.url },
    { label: 'View Source', action: () => window.open(`https://news.ycombinator.com/item?id=${id.value}`, '_blank') },
  ]
  if (visibleTopIds.value.length < topCommentIds.value.length) {
    actions.push({ label: 'Load More', action: loadMoreTop, shortcut: 'PgDn' })
  }
  setMenuActions(actions)
}

const storyHost = computed(() => hostFromUrl(story.value?.url))
const storyText = computed(() => sanitizeHtml(story.value?.text))

watch(isLoading, (l) => {
  setLoading(l)
})

watch([id, story, visibleTopIds], () => {
  updateMenu()
})

onMounted(async () => {
  await loadStory()
  updateMenu()
})

onBeforeUnmount(() => {
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000]">
      <div class="font-bold mb-2 uppercase">!! ACCESS DENIED !!</div>
      <div class="mb-4">{{ error }}</div>
      <button class="tui-btn" @click="loadStory">RETRY</button>
    </div>

    <template v-else-if="story">
      <div class="p-4 border-2 border-tui-border bg-tui-bg shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
        <h1 class="font-black mb-4 uppercase leading-tight text-tui-yellow">
          <a v-if="story.url" :href="story.url" target="_blank" rel="noreferrer" class="hover:underline">
            {{ story.title ?? 'UNTITLED' }}
          </a>
          <template v-else>{{ story.title ?? 'UNTITLED' }}</template>
        </h1>
        
        <div class="flex flex-wrap gap-x-6 gap-y-2 mb-6 border-y border-tui-active/30 py-2 font-mono uppercase">
          <div class="flex gap-1"><span class="text-tui-cyan">AUTHOR:</span><span class="text-white font-bold">{{ story.by }}</span></div>
          <div class="flex gap-1"><span class="text-tui-cyan">SCORE:</span><span class="text-white font-bold">{{ story.score }}</span></div>
          <div class="flex gap-1"><span class="text-tui-cyan">TIME:</span><span class="text-white font-bold">{{ timeAgo(story.time) }}</span></div>
          <div v-if="storyHost" class="flex gap-1 truncate"><span class="text-tui-cyan">HOST:</span><span class="text-white font-bold truncate">{{ storyHost }}</span></div>
        </div>

        <div v-if="storyText" class="font-content border-l-4 border-tui-active pl-4 py-2 mb-2 bg-tui-active/5 break-words leading-relaxed" v-html="storyText" />
      </div>

      <div class="mt-6">
        <div class="bg-tui-active text-white px-2 font-bold uppercase mb-4 border-b border-tui-border/30">
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
    
    <div v-else-if="loading" class="text-center py-20">
      <div>LOADING...</div>
      <div class="mt-2 text-tui-cyan">[▉▉▉▉▉▉▉▉▉▉      ]</div>
    </div>
  </div>
</template>
