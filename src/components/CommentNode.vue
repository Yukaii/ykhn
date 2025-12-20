<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HnItem } from '../api/types'
import { timeAgo, pluralize } from '../lib/format'
import { sanitizeHtml } from '../lib/sanitize'

defineOptions({ name: 'CommentNode' })

const props = defineProps<{
  id: number
  itemsById: Map<number, HnItem>
  loadKids: (ids: number[]) => Promise<void>
}>()

const expanded = ref(true)
const loadedKids = ref(false)

const item = computed(() => props.itemsById.get(props.id))
const kids = computed(() => item.value?.kids ?? [])
const text = computed(() => sanitizeHtml(item.value?.text))

async function toggle() {
  if (!expanded.value && kids.value.length > 0 && !loadedKids.value) {
    await props.loadKids(kids.value)
    loadedKids.value = true
  }
  expanded.value = !expanded.value
}

async function ensureKids() {
  if (kids.value.length === 0 || loadedKids.value) return
  await props.loadKids(kids.value)
  loadedKids.value = true
}
</script>

<template>
  <div v-if="item" class="comment">
    <div class="comment__meta">
      <span class="comment__by">{{ item.by ?? 'unknown' }}</span>
      <span class="muted">·</span>
      <span class="muted">{{ timeAgo(item.time) }}</span>
    </div>

    <div v-if="text" class="comment__text" v-html="text" />
    <div v-else class="comment__text muted">(no text)</div>

    <div v-if="kids.length" class="comment__actions">
      <button class="btn btn--ghost" type="button" @click="toggle">
        {{ expanded ? 'Hide' : `Show ${kids.length} ${pluralize(kids.length, 'reply')}` }}
      </button>
      <button
        v-if="expanded && !loadedKids"
        class="btn btn--ghost"
        type="button"
        @click="ensureKids"
      >
        Load replies
      </button>
    </div>

    <div v-if="expanded && kids.length" class="comment__kids">
      <CommentNode
        v-for="kidId in kids"
        :key="kidId"
        :id="kidId"
        :items-by-id="itemsById"
        :load-kids="loadKids"
      />
    </div>
  </div>
  <div v-else class="comment comment--skeleton">
    <div class="comment__meta">
      <span class="skeleton skeleton--short" />
    </div>
    <div class="comment__text">
      <span class="skeleton" />
      <span class="skeleton" />
    </div>
  </div>
</template>
