<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import ToastBar from './components/ToastBar.vue'
</script>

<template>
  <div class="flex-1 flex flex-col p-2 md:p-4 overflow-hidden h-screen">
    <!-- Main Window -->
    <div class="tui-window flex-1 flex flex-col overflow-hidden relative">
      <AppHeader />

      <main class="flex-1 overflow-y-auto p-2 md:p-4">
        <RouterView />
      </main>

      <!-- TUI Status/Nav Bar -->
      <AppNav />
    </div>
    
    <ToastBar />
  </div>
</template>
