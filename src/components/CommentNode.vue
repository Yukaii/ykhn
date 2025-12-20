<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HnItem } from '../api/types'
import { timeAgo } from '../lib/format'
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
  <div v-if="item" class="border-l-2 border-tui-active pl-2 md:pl-4 mb-4">
    <div class="flex items-center gap-2 text-[0.6rem] md:text-[0.7rem] bg-tui-active/30 px-2 py-1 mb-2 font-bold uppercase overflow-hidden">
      <span class="text-tui-yellow truncate">{{ item.by ?? 'GUEST' }}</span>
      <span class="opacity-50">|</span>
      <span class="whitespace-nowrap">{{ timeAgo(item.time).toUpperCase() }}</span>
    </div>

    <div v-if="expanded">
      <div v-if="text" class="prose prose-invert max-w-none text-[0.85rem] md:text-[0.9rem] leading-relaxed mb-3 font-sans break-words" v-html="text" />
      <div v-else class="text-[0.6rem] opacity-30 mb-2 italic">-- NO_DATA_FIELD --</div>
    </div>

    <div v-if="kids.length" class="flex gap-4">
      <button class="text-[0.6rem] md:text-[0.7rem] font-bold text-tui-cyan hover:bg-tui-cyan hover:text-tui-bg px-1 border border-tui-cyan/30 transition-none" type="button" @click="toggle">
        {{ expanded ? '[ - ]' : `[ +${kids.length} ]` }}
      </button>
      <button
        v-if="expanded && !loadedKids"
        class="text-[0.6rem] md:text-[0.7rem] font-bold text-tui-yellow hover:bg-tui-yellow hover:text-tui-bg px-1 border border-tui-yellow/30 transition-none"
        type="button"
        @click="ensureKids"
      >
        [ LOAD_SUB ]
      </button>
    </div>

    <div v-if="expanded && kids.length && (loadedKids || itemsById.has(kids[0] as number))" class="flex flex-col gap-4 mt-4">
      <CommentNode
        v-for="kidId in (kids as number[])"
        :key="kidId"
        :id="kidId"
        :items-by-id="itemsById"
        :load-kids="loadKids"
      />
    </div>
  </div>
  <div v-else class="border-l-2 border-tui-active/20 pl-2 md:pl-4 mb-4 animate-pulse">
    <div class="h-3 bg-tui-active/20 w-16 mb-2"></div>
    <div class="h-8 bg-tui-active/10 w-full"></div>
  </div>
</template>
