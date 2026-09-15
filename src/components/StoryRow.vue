<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { HnItem } from '../api/types'
import { hostFromUrl, timeAgo } from '../lib/format'

const props = defineProps<{
  item: HnItem
  selected?: boolean
  voted?: boolean
}>()

const host = computed(() => hostFromUrl(props.item.url))
const rowVariant = computed(() => {
  if (props.item.type === 'job') return 'JOB'
  if (props.item.type === 'poll') return 'POLL'
  if (!props.item.url) return 'TEXT'
  return 'LINK'
})
</script>

<template>
  <div
    class="tui-list-item group border-b border-tui-active/30 last:border-b-0"
    :class="selected ? 'active' : ''"
  >
    <div
      class="flex-none w-12 text-right font-bold tabular-nums pt-0.5"
      :class="selected ? 'text-current' : 'text-tui-text/60 group-hover:text-current'"
    >
      {{ item.score ?? 0 }}
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-2">
        <a
          v-if="item.url"
          class="font-bold break-words leading-snug"
          :class="selected ? 'underline' : 'group-hover:underline'"
          :href="item.url"
          target="_blank"
          rel="noreferrer"
        >
          {{ item.title ?? 'UNTITLED.DAT' }}
        </a>
        <RouterLink
          v-else
          class="font-bold break-words leading-snug"
          :class="selected ? 'underline' : 'group-hover:underline'"
          :to="`/item/${item.id}`"
        >
          {{ item.title ?? 'UNTITLED.DAT' }}
        </RouterLink>
        <span
          v-if="host"
          class="uppercase break-all md:break-normal"
          :class="selected ? 'text-current opacity-80' : 'text-tui-cyan group-hover:text-current'"
        >
          ({{ host }})
        </span>
      </div>

      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 min-w-0 text-[0.92em]"
        :class="
          selected ? 'opacity-100 text-current' : 'group-hover:opacity-100 group-hover:text-current'
        "
      >
        <span
          class="tui-chip"
          :class="
            selected
              ? 'border-current text-current'
              : 'group-hover:border-current group-hover:text-current'
          "
        >
          {{ rowVariant }}
        </span>
        <span
          v-if="voted"
          class="tui-chip font-bold"
          :class="
            selected
              ? 'border-current text-current'
              : 'border-tui-yellow text-tui-yellow group-hover:border-current group-hover:text-current'
          "
        >
          VOTED
        </span>
        <span
          class="break-all tui-meta"
          :class="selected ? 'text-current' : 'group-hover:text-current'"
        >
          BY: {{ item.by?.toUpperCase() ?? 'UNKNOWN' }}
        </span>
        <span class="whitespace-nowrap">{{ timeAgo(item.time).toUpperCase() }}</span>
        <RouterLink
          :to="`/item/${item.id}`"
          class="font-bold underline"
          :class="selected ? 'text-current' : 'text-tui-yellow group-hover:text-current'"
        >
          {{ item.descendants ?? 0 }} COMM
        </RouterLink>
      </div>
    </div>

    <RouterLink class="tui-btn flex-none self-center text-xs py-0.5 px-2" :to="`/item/${item.id}`">
      VIEW
    </RouterLink>
  </div>
</template>
