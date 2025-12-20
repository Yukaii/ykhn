import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import './style.css'
import App from './App.vue'
import { router } from './router'
import { markNeedRefresh, markOfflineReady } from './pwa'

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    markOfflineReady()
  },
  onNeedRefresh() {
    markNeedRefresh(updateServiceWorker)
  },
})

// Initialize font size from localStorage
const savedFontSize = localStorage.getItem('ykhn-font-size')
if (savedFontSize) {
  document.documentElement.style.setProperty('--tui-font-size', `${savedFontSize}px`)
}

createApp(App).use(router).mount('#app')
