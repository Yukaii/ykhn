<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, onMounted } from 'vue'
import { useAsyncState } from '@vueuse/core'

import { fetchFeedIds, fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import type { FeedKind } from '../router'
import StoryRow from '../components/StoryRow.vue'
import { setMenuActions, setMenuTitle, setLoading } from '../store'

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
const page = ref(1)
const pageSize = 30

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
  page.value = 1
  await executeLoadIds()
  await executeLoadItems()
}

function next() {
  if (!canNext.value) return
  page.value++
}

function prev() {
  if (!canPrev.value) return
  page.value--
}

function updateMenu() {
  setMenuTitle(`DIR: ${title.value.toUpperCase()}\\*.*`)
  setMenuActions([
    { label: 'Refresh', action: refresh, shortcut: 'F5' },
    { label: 'Next Page', action: next, shortcut: 'PgDn', disabled: !canNext.value },
    { label: 'Prev Page', action: prev, shortcut: 'PgUp', disabled: !canPrev.value },
  ])
}

watch([loadingIds, loadingItems], ([l1, l2]) => {
  setLoading(l1 || l2)
})

watch([() => props.feed, canNext, canPrev, title], () => {
  updateMenu()
})

watch(
  () => props.feed,
  async () => {
    await refresh()
  },
  { immediate: true },
)

watch(page, async () => {
  await executeLoadItems()
})

onMounted(() => {
  updateMenu()
})

onBeforeUnmount(() => {
  setMenuActions([])
  setMenuTitle('')
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="error" class="bg-red-600 p-4 border-2 border-white shadow-[8px_8px_0px_#000000] text-center">
      <div class="font-bold mb-2 uppercase">!! DISK READ ERROR !!</div>
      <div class="mb-4">{{ error }}</div>
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
