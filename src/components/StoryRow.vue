<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { HnItem } from '../api/types'
import { hostFromUrl, timeAgo } from '../lib/format'

const props = defineProps<{
  item: HnItem
}>()

const host = hostFromUrl(props.item.url)
</script>

<template>
  <div class="tui-list-item group border-b border-tui-active/30 last:border-b-0 py-2">
    <div class="flex-none w-8 text-right text-tui-gray group-hover:text-tui-bg">
      {{ item.score ?? 0 }}
    </div>
    
    <div class="flex-1 min-w-0">
      <div class="flex flex-col md:flex-row md:items-baseline md:gap-2">
        <a
          v-if="item.url"
          class="font-bold truncate group-hover:underline"
          :href="item.url"
          target="_blank"
          rel="noreferrer"
        >
          {{ item.title ?? 'UNTITLED.DAT' }}
        </a>
        <RouterLink v-else class="font-bold truncate group-hover:underline" :to="`/item/${item.id}`">
          {{ item.title ?? 'UNTITLED.DAT' }}
        </RouterLink>
        <span v-if="host" class="text-[10px] text-tui-cyan group-hover:text-tui-bg uppercase">
          ({{ host }})
        </span>
      </div>

      <div class="flex gap-3 text-[10px] opacity-70 group-hover:opacity-100 group-hover:text-tui-bg">
        <span>BY: {{ item.by?.toUpperCase() }}</span>
        <span>{{ timeAgo(item.time).toUpperCase() }}</span>
        <RouterLink :to="`/item/${item.id}`" class="text-tui-yellow group-hover:text-tui-bg font-bold underline">
          {{ item.descendants ?? 0 }} COMM
        </RouterLink>
      </div>
    </div>
    
    <RouterLink 
      class="flex-none px-2 bg-tui-active text-white text-xs group-hover:bg-tui-bg group-hover:text-tui-cyan" 
      :to="`/item/${item.id}`"
    >
      VIEW
    </RouterLink>
  </div>
</template>
