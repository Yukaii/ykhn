<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import ToastBar from './components/ToastBar.vue'
</script>

<template>
  <div class="app">
    <AppHeader />

    <main class="app-main">
      <RouterView />
    </main>

    <AppNav />
    <ToastBar />
  </div>
</template>
