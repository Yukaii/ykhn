import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import './style.css'
import App from './App.vue'
import { router } from './router'
import { markOfflineReady } from './pwa'
import { initAuthFromStorage, initThemeFromStorage } from './store'
import { initGA } from './lib/ga'

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000
const SW_UPDATE_THROTTLE_MS = 60 * 1000

function startServiceWorkerUpdateChecks(registration: ServiceWorkerRegistration) {
  let lastCheck = 0

  function checkForUpdate() {
    const now = Date.now()
    if (!navigator.onLine || now - lastCheck < SW_UPDATE_THROTTLE_MS) return

    lastCheck = now
    void registration.update().catch(() => undefined)
  }

  window.setInterval(checkForUpdate, SW_UPDATE_INTERVAL_MS)
  window.addEventListener('online', checkForUpdate)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
}

registerSW({
  immediate: true,
  onOfflineReady() {
    markOfflineReady()
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) startServiceWorkerUpdateChecks(registration)
  },
})

initThemeFromStorage()
void initAuthFromStorage()
initGA()

createApp(App).use(router).mount('#app')
