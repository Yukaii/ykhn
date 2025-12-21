<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { HnItem } from '../api/types'
import { hostFromUrl, timeAgo } from '../lib/format'

const props = defineProps<{
  item: HnItem
  selected?: boolean
}>()

const host = computed(() => hostFromUrl(props.item.url))
</script>

<template>
  <div
    class="tui-list-item group border-b border-tui-active/30 last:border-b-0 py-2"
    :class="selected ? 'bg-tui-cyan text-tui-bg' : ''"
  >
    <div
      class="flex-none w-10 text-right font-bold"
      :class="selected ? 'text-tui-bg' : 'text-tui-text/60 group-hover:text-tui-bg'"
    >
      {{ item.score ?? 0 }}
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex flex-col md:flex-row md:items-baseline md:gap-2">
        <a
          v-if="item.url"
          class="font-bold break-words"
          :class="selected ? 'underline' : 'group-hover:underline'"
          :href="item.url"
          target="_blank"
          rel="noreferrer"
        >
          {{ item.title ?? 'UNTITLED.DAT' }}
        </a>
        <RouterLink
          v-else
          class="font-bold break-words"
          :class="selected ? 'underline' : 'group-hover:underline'"
          :to="`/item/${item.id}`"
        >
          {{ item.title ?? 'UNTITLED.DAT' }}
        </RouterLink>
        <span
          v-if="host"
          class="uppercase break-all md:break-normal"
          :class="selected ? 'text-tui-bg' : 'text-tui-cyan group-hover:text-tui-bg'"
        >
          ({{ host }})
        </span>
      </div>

      <div
        class="flex flex-wrap gap-x-3 gap-y-1 opacity-70 min-w-0"
        :class="selected ? 'opacity-100 text-tui-bg' : 'group-hover:opacity-100 group-hover:text-tui-bg'"
      >
        <span class="break-all">BY: {{ item.by?.toUpperCase() }}</span>
        <span class="whitespace-nowrap">{{ timeAgo(item.time).toUpperCase() }}</span>
        <RouterLink
          :to="`/item/${item.id}`"
          class="text-tui-yellow font-bold underline"
          :class="selected ? 'text-tui-bg' : 'group-hover:text-tui-bg'"
        >
          {{ item.descendants ?? 0 }} COMM
        </RouterLink>
      </div>
    </div>

    <RouterLink
      class="flex-none px-2 bg-tui-active text-tui-text"
      :class="selected ? 'bg-tui-bg text-tui-cyan' : 'group-hover:bg-tui-bg group-hover:text-tui-cyan'"
      :to="`/item/${item.id}`"
    >
      VIEW
    </RouterLink>
  </div>
</template>
