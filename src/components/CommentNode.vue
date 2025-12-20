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
  <div v-if="item" class="relative ml-2 md:ml-4 mb-4">
    <!-- Visual branch for threading -->
    <div class="absolute left-[-10px] md:left-[-16px] top-0 bottom-0 border-l border-tui-active/30"></div>
    <div class="absolute left-[-10px] md:left-[-16px] top-4 w-2 md:w-3 border-t border-tui-active/30"></div>

    <div class="tui-comment-card">
      <div class="flex items-center justify-between gap-2 text-[0.65rem] md:text-[0.7rem] bg-tui-active/40 px-2 py-1 mb-2 font-mono">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="text-tui-gray">USR:</span>
            <span class="text-tui-yellow font-bold">{{ item.by ?? 'GUEST' }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-tui-gray">DATE:</span>
            <span class="text-tui-cyan whitespace-nowrap">{{ timeAgo(item.time).toUpperCase() }}</span>
          </div>
        </div>
        <button 
          v-if="kids.length" 
          @click="toggle" 
          class="bg-tui-bg text-tui-border px-2 border border-tui-border/30 hover:bg-tui-border hover:text-tui-bg transition-none"
        >
          {{ expanded ? '[-] COLLAPSE' : `[+] EXPAND ${kids.length}` }}
        </button>
      </div>

      <div v-if="expanded" class="px-1">
        <div v-if="text" class="prose prose-invert max-w-none text-[0.85rem] md:text-[0.95rem] leading-relaxed mb-1 font-content break-words" v-html="text" />
        <div v-else class="text-[0.6rem] opacity-30 mb-2 italic">-- NO_CONTENT --</div>
        
        <div v-if="expanded && kids.length && !loadedKids" class="mt-2 text-right">
          <button
            class="text-[0.65rem] md:text-[0.7rem] font-bold text-tui-yellow hover:bg-tui-yellow hover:text-tui-bg px-2 border border-tui-yellow/30 transition-none uppercase"
            type="button"
            @click="ensureKids"
          >
            [ LOAD_{{ kids.length }}_SUB_ENTRIES ]
          </button>
        </div>
      </div>
    </div>

    <!-- Recursive children -->
    <div v-if="expanded && kids.length && (loadedKids || itemsById.has(kids[0] as number))" class="flex flex-col mt-2">
      <CommentNode
        v-for="kidId in (kids as number[])"
        :key="kidId"
        :id="kidId"
        :items-by-id="itemsById"
        :load-kids="loadKids"
      />
    </div>
  </div>
  
  <div v-else class="ml-2 md:ml-4 mb-4 opacity-30">
    <div class="tui-comment-card animate-pulse">
      <div class="h-3 bg-tui-active/40 w-24 mb-2"></div>
      <div class="h-10 bg-tui-active/20 w-full"></div>
    </div>
  </div>
</template>
