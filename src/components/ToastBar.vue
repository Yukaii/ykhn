<script setup lang="ts">
import { computed } from 'vue'
import { applyAppUpdate, dismissOfflineReady, pwaState } from '../pwa'

const show = computed(() => pwaState.offlineReady || pwaState.needRefresh)

async function onUpdate() {
  await applyAppUpdate()
}
</script>

<template>
  <div v-if="show" class="toast" role="status" aria-live="polite">
    <div class="toast__content">
      <div v-if="pwaState.needRefresh" class="toast__title">Update available</div>
      <div v-else class="toast__title">Ready for offline use</div>
      <div class="toast__subtitle">
        <span v-if="pwaState.needRefresh">Reload to get the latest version.</span>
        <span v-else>Pages you visit are cached.</span>
      </div>
    </div>

    <div class="toast__actions">
      <button v-if="pwaState.needRefresh" class="btn" type="button" @click="onUpdate">
        Reload
      </button>
      <button v-else class="btn btn--ghost" type="button" @click="dismissOfflineReady">
        Dismiss
      </button>
    </div>
  </div>
</template>
