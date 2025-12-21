import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import './style.css'
import App from './App.vue'
import { router } from './router'
import { markNeedRefresh, markOfflineReady } from './pwa'
import { initThemeFromStorage } from './store'

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    markOfflineReady()
  },
  onNeedRefresh() {
    markNeedRefresh(updateServiceWorker)
  },
})

initThemeFromStorage()

createApp(App).use(router).mount('#app')
