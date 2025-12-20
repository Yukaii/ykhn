<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { fetchFeedIds, fetchItems } from '../api/hn'
import type { HnItem } from '../api/types'
import type { FeedKind } from '../router'
import StoryRow from '../components/StoryRow.vue'
import { useOnline } from '../composables/useOnline'

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

const { online } = useOnline()

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
  <div class="page">
    <header class="page-header">
      <div class="page-header__row">
        <h1>{{ title }}</h1>
        <button class="btn btn--ghost" type="button" :disabled="loadingIds" @click="refresh">
          Refresh
        </button>
      </div>

      <p class="muted">
        <span v-if="loadingIds">Loading…</span>
        <span v-else-if="ids.length">{{ ids.length }} stories</span>
        <span v-else>—</span>
        <span class="muted">·</span>
        <span class="muted">Page {{ page }} / {{ totalPages }}</span>
        <span v-if="!online" class="muted">· offline</span>
      </p>

      <div v-if="!online" class="note">
        You’re offline. If you’ve opened this feed before, cached stories will still show.
      </div>
    </header>

    <div v-if="error" class="card">
      <div class="error-title">Couldn’t load</div>
      <div class="muted">{{ error }}</div>
      <div class="actions">
        <button class="btn" type="button" @click="refresh">Try again</button>
      </div>
    </div>

    <section v-else class="stack">
      <div v-if="loadingItems && items.length === 0" class="stack">
        <div v-for="n in 10" :key="n" class="story story--skeleton">
          <div class="story__main">
            <div class="skeleton" />
            <div class="skeleton skeleton--short" />
          </div>
        </div>
      </div>

      <div v-else class="stack">
        <StoryRow v-for="item in items" :key="item.id" :item="item" />
      </div>

      <div class="pager">
        <button class="btn btn--ghost" type="button" :disabled="!canPrev" @click="prev">
          Prev
        </button>
        <button class="btn" type="button" :disabled="!canNext" @click="next">Next</button>
      </div>
    </section>
  </div>
</template>
