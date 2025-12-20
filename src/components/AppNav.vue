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
  <nav class="app-nav" aria-label="Feeds">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      class="app-nav__tab"
      :class="isActive(tab.to) ? 'app-nav__tab--active' : ''"
      :to="tab.to"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
