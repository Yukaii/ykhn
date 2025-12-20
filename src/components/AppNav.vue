<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { to: '/', label: 'Top' },
  { to: '/new', label: 'New' },
  { to: '/best', label: 'Best' },
  { to: '/ask', label: 'Ask' },
  { to: '/show', label: 'Show' },
  { to: '/jobs', label: 'Jobs' },
]

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="bg-tui-active border-t-2 border-tui-border flex flex-wrap md:flex-nowrap" aria-label="Feeds">
    <RouterLink
      v-for="(tab, index) in tabs"
      :key="tab.to"
      class="tui-f-key hover:bg-tui-cyan hover:text-tui-bg transition-none"
      :class="isActive(tab.to) ? 'bg-tui-yellow text-tui-bg' : ''"
      :to="tab.to"
    >
      <span>F{{ index + 1 }}</span>{{ tab.label }}
    </RouterLink>
  </nav>
</template>
