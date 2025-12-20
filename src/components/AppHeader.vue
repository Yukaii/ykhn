<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOnline } from '../composables/useOnline'

const { online } = useOnline()
</script>

<template>
  <div class="tui-title-bar sticky top-0 z-10">
    <div class="flex items-center gap-2">
      <span class="bg-tui-bg text-tui-cyan px-1">≡</span>
      <RouterLink to="/" class="hover:bg-tui-bg hover:text-tui-cyan px-1 transition-none">
        YKHN_OS V1.0
      </RouterLink>
    </div>
    
    <div class="flex items-center gap-4 text-xs">
      <span :class="online ? 'text-tui-bg' : 'bg-red-600 text-white px-1 animate-pulse'">
        {{ online ? '[ONLINE]' : '[OFFLINE]' }}
      </span>
      <RouterLink to="/about" class="hover:bg-tui-bg hover:text-tui-cyan px-1">F9 SETUP</RouterLink>
      <span class="hidden md:inline">C:\HN\STORIES\</span>
    </div>
  </div>
</template>
