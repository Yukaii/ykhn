<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { ref } from 'vue'
import { useScroll } from '@vueuse/core'

const route = useRoute()
const el = ref<HTMLElement | null>(null)
const { x, arrivedState } = useScroll(el, { behavior: 'auto' })

const tabs = [
  { to: '/', label: 'Top' },
  { to: '/new', label: 'New' },
  { to: '/best', label: 'Best' },
  { to: '/ask', label: 'Ask' },
  { to: '/show', label: 'Show' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/search', label: 'Search' },
]

function scroll(dir: 'left' | 'right') {
  if (!el.value) return
  const amount = 120
  x.value += dir === 'left' ? -amount : amount
}

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="bg-tui-active border-t-2 border-tui-border relative flex items-center h-10 overflow-hidden" aria-label="Feeds">
    <!-- Left Overflow Indicator -->
    <button 
      v-if="!arrivedState.left"
      @click="scroll('left')"
      class="absolute left-0 top-0 bottom-0 flex items-center px-1 bg-tui-active text-tui-yellow font-bold z-10 hover:bg-tui-cyan hover:text-tui-bg transition-none border-r border-tui-border/30"
    >
      &lt;
    </button>

    <div ref="el" class="flex-1 flex overflow-x-auto no-scrollbar h-full">
      <RouterLink
        v-for="(tab, index) in tabs"
        :key="tab.to"
        class="tui-f-key flex items-center justify-center hover:bg-tui-cyan hover:text-tui-bg transition-none whitespace-nowrap px-4 shrink-0 h-full"
        :class="isActive(tab.to) ? 'bg-tui-yellow text-tui-bg' : ''"
        :to="tab.to"
      >
        <span>F{{ index + 1 }}</span>{{ tab.label }}
      </RouterLink>
    </div>

    <!-- Right Overflow Indicator -->
    <button 
      v-if="!arrivedState.right"
      @click="scroll('right')"
      class="absolute right-0 top-0 bottom-0 flex items-center px-1 bg-tui-active text-tui-yellow font-bold z-10 hover:bg-tui-cyan hover:text-tui-bg transition-none border-l border-tui-border/30"
    >
      &gt;
    </button>
  </nav>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
