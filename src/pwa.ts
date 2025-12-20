import { reactive } from 'vue'

export type PwaUpdateFn = (reloadPage?: boolean) => Promise<void>

export const pwaState = reactive({
  offlineReady: false,
  needRefresh: false,
  updateServiceWorker: null as PwaUpdateFn | null,
})

export function markOfflineReady() {
  pwaState.offlineReady = true
}

export function markNeedRefresh(update: PwaUpdateFn) {
  pwaState.needRefresh = true
  pwaState.updateServiceWorker = update
}

export async function applyAppUpdate() {
  if (!pwaState.updateServiceWorker) return
  await pwaState.updateServiceWorker(true)
  pwaState.needRefresh = false
}

export function dismissOfflineReady() {
  pwaState.offlineReady = false
}
