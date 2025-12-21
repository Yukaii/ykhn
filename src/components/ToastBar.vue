<script setup lang="ts">
import { computed, ref } from 'vue'
import { applyAppUpdate, dismissOfflineReady, pwaState } from '../pwa'

const show = computed(() => pwaState.offlineReady || pwaState.needRefresh)
const updating = ref(false)

async function onUpdate() {
  if (updating.value) return
  updating.value = true
  try {
    await applyAppUpdate()
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed bottom-12 left-2 right-2 md:left-auto md:right-8 md:bottom-12 md:w-80 bg-tui-gray border-4 border-double border-tui-border p-4 z-50 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] text-tui-text" role="status" aria-live="polite">
    <div class="mb-4">
      <div v-if="pwaState.needRefresh" class="font-black uppercase mb-1 underline">! SYSTEM ALERT !</div>
      <div v-else class="font-black uppercase mb-1 underline">! DISK READY !</div>
      <div>
        <span v-if="pwaState.needRefresh">NEW VERSION AVAILABLE. REFRESH TO UPDATE?</span>
        <span v-else>OFFLINE CACHE HAS BEEN INITIALIZED SUCCESSFULLY.</span>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <button
        v-if="pwaState.needRefresh"
        class="tui-btn bg-tui-bg text-tui-text"
        type="button"
        :disabled="updating"
        :class="updating ? 'opacity-60 cursor-not-allowed' : ''"
        @click="onUpdate"
      >
        [REFRESH]
      </button>
      <button v-else class="tui-btn" type="button" @click="dismissOfflineReady">
        [DISMISS]
      </button>
    </div>
  </div>
</template>
