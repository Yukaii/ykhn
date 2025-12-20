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
  selectedId?: number | null
  isLast?: boolean
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)

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
  <div
    v-if="item"
    class="relative mb-4"
    :data-ykhn-comment-id="String(id)"
    :class="depth > 0 ? (depth > 5 ? 'ml-2' : 'ml-6') : ''"
  >
    <!-- Visual branch for threading -->
    <div v-if="depth > 0" class="absolute left-[-18px] top-4 text-tui-active/50 font-mono leading-none">
      {{ isLast ? '└─' : '├─' }}
    </div>
    <div v-if="depth > 0 && !isLast" class="absolute left-[-18px] top-8 bottom-[-16px] border-l border-tui-active/30"></div>

    <div class="tui-comment-card" :class="selectedId === id ? 'border-2 border-tui-yellow bg-tui-active/10' : ''">
      <div class="flex items-center justify-between gap-2 bg-tui-active/40 px-2 py-1 mb-2 font-mono">
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
        <div v-if="text" class="prose prose-invert max-w-none leading-relaxed mb-1 font-content break-words" v-html="text" />
        <div v-else class="opacity-30 mb-2 italic">-- NO_CONTENT --</div>
        
        <div v-if="expanded && kids.length && !loadedKids" class="mt-2 text-right">
          <button
            class="font-bold text-tui-yellow hover:bg-tui-yellow hover:text-tui-bg px-2 border border-tui-yellow/30 transition-none uppercase"
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
        v-for="(kidId, index) in (kids as number[])"
        :key="kidId"
        :id="kidId"
        :items-by-id="itemsById"
        :load-kids="loadKids"
        :selected-id="selectedId"
        :is-last="index === kids.length - 1"
        :depth="depth + 1"
      />
    </div>
  </div>
  
  <div v-else class="relative mb-4" :class="depth > 0 ? (depth > 5 ? 'ml-2' : 'ml-6') : ''">
    <!-- Skeleton branch -->
    <div v-if="depth > 0" class="absolute left-[-18px] top-4 text-tui-active/20 font-mono">
      {{ isLast ? '└─' : '├─' }}
    </div>
    
    <div class="tui-comment-card opacity-20 border-dashed">
      <div class="h-6 bg-tui-active/40 w-full mb-2"></div>
      <div class="h-4 bg-tui-active/20 w-3/4 mb-1"></div>
      <div class="h-4 bg-tui-active/20 w-1/2"></div>
    </div>
  </div>
</template>
