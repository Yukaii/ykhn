<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { fetchFeedIds, fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import type { FeedKind } from '../router'
import StoryRow from '../components/StoryRow.vue'

const props = defineProps<{
  feed: FeedKind
}>()

const feedTitle: Record<FeedKind, string> = {
  top: 'Top',
  new: 'New',
  best: 'Best',
  ask: 'Ask',
  show: 'Show',
  jobs: 'Jobs',
}

const title = computed(() => feedTitle[props.feed])

const ids = ref<number[]>([])
const items = ref<HnItem[]>([])

const page = ref(1)
const pageSize = 30

const loadingIds = ref(false)
const loadingItems = ref(false)
const error = ref<string | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(ids.value.length / pageSize)))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

let abortIds: AbortController | null = null

async function loadIds() {
  abortIds?.abort()
  abortIds = new AbortController()

  loadingIds.value = true
  error.value = null

  try {
    ids.value = await fetchFeedIds(props.feed, abortIds.signal)
  } catch (e) {
    if (abortIds.signal.aborted) return
    error.value = e instanceof Error ? e.message : 'Failed to load feed'
    ids.value = []
  } finally {
    if (!abortIds.signal.aborted) loadingIds.value = false
  }
}

async function loadItemsForPage() {
  if (ids.value.length === 0) {
    items.value = []
    return
  }

  const start = (page.value - 1) * pageSize
  const slice = ids.value.slice(start, start + pageSize)

  loadingItems.value = true
  error.value = null

  try {
    items.value = await fetchItems(slice)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load stories'
    items.value = []
  } finally {
    loadingItems.value = false
  }
}

async function refresh() {
  page.value = 1
  await loadIds()
  await loadItemsForPage()
}

function next() {
  if (!canNext.value) return
  page.value++
}

function prev() {
  if (!canPrev.value) return
  page.value--
}

watch(
  () => props.feed,
  async () => {
    await refresh()
  },
  { immediate: true },
)

watch(page, async () => {
  await loadItemsForPage()
})

onBeforeUnmount(() => {
  abortIds?.abort()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 bg-tui-active/20 p-2 border border-tui-border/50">
      <div class="flex flex-col">
        <h1 class="text-xl font-black text-tui-yellow uppercase">
          DIRECTORY: {{ title }}\*.*
        </h1>
        <div class="text-[10px] opacity-70">
          SELECTING {{ items.length }} OF {{ ids.length }} OBJECTS
        </div>
      </div>
      
      <div class="flex gap-2 mt-2 md:mt-0">
        <button class="tui-btn text-xs" @click="refresh">REFRESH</button>
        <div class="flex border border-tui-border">
          <button 
            class="px-2 bg-tui-gray text-tui-bg hover:bg-tui-cyan disabled:opacity-30 transition-none" 
            :disabled="!canPrev" 
            @click="prev"
          >
            ↑
          </button>
          <div class="px-3 bg-tui-bg text-tui-cyan text-xs flex items-center">
            P{{ page }}/{{ totalPages }}
          </div>
          <button 
            class="px-2 bg-tui-gray text-tui-bg hover:bg-tui-cyan disabled:opacity-30 transition-none" 
            :disabled="!canNext" 
            @click="next"
          >
            ↓
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000] text-center">
      <div class="text-xl font-bold mb-2 uppercase">!! DISK READ ERROR !!</div>
      <div class="text-sm mb-4">{{ error }}</div>
      <button class="tui-btn" @click="refresh">RETRY</button>
    </div>

    <div v-else class="flex-1">
      <div v-if="loadingItems && items.length === 0" class="flex flex-col divide-y divide-tui-active/30">
        <div v-for="n in 15" :key="n" class="p-2 animate-pulse flex gap-2">
          <div class="w-8 h-4 bg-tui-active/40"></div>
          <div class="flex-1 h-4 bg-tui-active/20"></div>
        </div>
      </div>

      <div v-else class="flex flex-col">
        <StoryRow v-for="item in items" :key="item.id" :item="item" />
      </div>
    </div>
  </div>
</template>
