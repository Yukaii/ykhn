import { reactive } from 'vue'

export const pwaState = reactive({
  offlineReady: false,
})

export function markOfflineReady() {
  pwaState.offlineReady = true
}

export function dismissOfflineReady() {
  pwaState.offlineReady = false
}
