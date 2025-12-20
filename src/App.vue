<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import ToastBar from './components/ToastBar.vue'
</script>

<template>
  <div class="flex-1 flex flex-col p-2 md:p-4 overflow-hidden h-screen bg-tui-bg">
    <!-- Main Window -->
    <div class="tui-window flex-1 flex flex-col overflow-hidden relative border-4">
      <AppHeader />

      <main class="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-tui-bg">
        <RouterView />
      </main>

      <!-- TUI Status/Nav Bar (Fixed at bottom of window) -->
      <AppNav class="sticky bottom-0 z-20" />
    </div>
    
    <ToastBar />
  </div>
</template>
