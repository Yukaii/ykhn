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
  <article class="story">
    <div class="story__main">
      <a
        v-if="item.url"
        class="story__title"
        :href="item.url"
        target="_blank"
        rel="noreferrer"
      >
        {{ item.title ?? 'Untitled' }}
      </a>
      <RouterLink v-else class="story__title" :to="`/item/${item.id}`">
        {{ item.title ?? 'Untitled' }}
      </RouterLink>

      <div class="story__meta">
        <span v-if="item.score !== undefined">{{ item.score }} pts</span>
        <span v-if="item.by">by {{ item.by }}</span>
        <span v-if="item.time">{{ timeAgo(item.time) }}</span>
        <span v-if="host">· {{ host }}</span>
      </div>
    </div>

    <RouterLink class="story__comments" :to="`/item/${item.id}`">
      <span class="story__comments-count">{{ item.descendants ?? 0 }}</span>
      <span class="story__comments-label">{{ (item.descendants ?? 0) === 1 ? 'comment' : 'comments' }}</span>
    </RouterLink>
  </article>
</template>
