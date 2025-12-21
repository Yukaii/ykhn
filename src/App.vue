<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import KeyboardHelp from './components/KeyboardHelp.vue'
import ToastBar from './components/ToastBar.vue'
import { useGlobalHotkeys } from './composables/useGlobalHotkeys'
import { useMainScrollRestoration } from './composables/useMainScrollRestoration'

useGlobalHotkeys()
useMainScrollRestoration()
</script>

<template>
  <div class="fixed inset-0 flex flex-col p-2 md:p-4 bg-tui-bg overflow-hidden h-[100dvh] w-screen pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] pl-[calc(0.5rem+env(safe-area-inset-left))] pr-[calc(0.5rem+env(safe-area-inset-right))]">
    <!-- Main Window -->
    <div class="tui-window flex-1 flex flex-col overflow-hidden relative border-4">
      <AppHeader />

      <main data-ykhn-main class="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-tui-bg">
        <RouterView />
      </main>

      <!-- TUI Status/Nav Bar (Locked at bottom of window) -->
      <AppNav class="flex-none z-20" />
    </div>
    
    <KeyboardHelp />
    <ToastBar />
  </div>
</template>
