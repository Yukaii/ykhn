<script setup lang="ts">
import { dismissOfflineReady, pwaState } from '../pwa'
</script>

<template>
  <div
    v-if="pwaState.offlineReady"
    class="fixed bottom-14 left-2 right-2 md:left-auto md:right-8 md:bottom-16 md:w-80 tui-panel z-50 text-tui-text"
    role="status"
    aria-live="polite"
  >
    <div class="mb-4">
      <div class="font-black uppercase mb-1 underline">! DISK READY !</div>
      <div>OFFLINE CACHE HAS BEEN INITIALIZED SUCCESSFULLY.</div>
    </div>

    <div class="flex justify-end gap-2">
      <button class="tui-btn" type="button" @click="dismissOfflineReady">[DISMISS]</button>
    </div>
  </div>
</template>
