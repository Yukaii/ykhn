<script setup lang="ts">
import { computed } from 'vue'
import { applyAppUpdate, dismissOfflineReady, pwaState } from '../pwa'

const show = computed(() => pwaState.offlineReady || pwaState.needRefresh)

async function onUpdate() {
  await applyAppUpdate()
}
</script>

<template>
  <div v-if="show" class="fixed bottom-12 left-2 right-2 md:left-auto md:right-8 md:bottom-12 md:w-80 bg-tui-gray border-4 border-double border-tui-bg p-4 z-50 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] text-tui-bg" role="status" aria-live="polite">
    <div class="mb-4">
      <div v-if="pwaState.needRefresh" class="text-sm font-black uppercase mb-1 underline">! SYSTEM ALERT !</div>
      <div v-else class="text-sm font-black uppercase mb-1 underline">! DISK READY !</div>
      <div class="text-xs">
        <span v-if="pwaState.needRefresh">NEW SYSTEM FILES DETECTED. APPLY UPDATE NOW?</span>
        <span v-else>OFFLINE CACHE HAS BEEN INITIALIZED SUCCESSFULLY.</span>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <button v-if="pwaState.needRefresh" class="tui-btn text-xs bg-tui-bg text-white" type="button" @click="onUpdate">
        [OK]
      </button>
      <button v-else class="tui-btn text-xs" type="button" @click="dismissOfflineReady">
        [DISMISS]
      </button>
    </div>
  </div>
</template>
