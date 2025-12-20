<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import ToastBar from './components/ToastBar.vue'
</script>

<template>
  <div class="fixed inset-0 flex flex-col p-2 md:p-4 bg-tui-bg overflow-hidden h-screen w-screen">
    <!-- Main Window -->
    <div class="tui-window flex-1 flex flex-col overflow-hidden relative border-4">
      <AppHeader />

      <main class="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-tui-bg">
        <RouterView />
      </main>

      <!-- TUI Status/Nav Bar (Locked at bottom of window) -->
      <AppNav class="flex-none z-20" />
    </div>
    
    <ToastBar />
  </div>
</template>
