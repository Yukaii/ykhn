import { nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { getMainScrollContainer } from '../lib/keyboard'

const STORAGE_PREFIX = 'ykhn:scroll:'

function keyFor(fullPath: string) {
  return `${STORAGE_PREFIX}${fullPath}`
}

function saveScroll(fullPath: string) {
  const el = getMainScrollContainer()
  if (!el) return
  sessionStorage.setItem(keyFor(fullPath), String(el.scrollTop))
}

async function restoreScroll(fullPath: string) {
  await nextTick()
  const el = getMainScrollContainer()
  if (!el) return

  const raw = sessionStorage.getItem(keyFor(fullPath))
  if (!raw) return

  const top = Number(raw)
  if (!Number.isFinite(top)) return

  // Attempt a couple times to handle async content.
  el.scrollTop = top
  await nextTick()
  el.scrollTop = top
}

let installed = false

export function useMainScrollRestoration() {
  const router = useRouter()

  onMounted(() => {
    if (installed) return
    installed = true

    router.beforeEach((_to, from) => {
      if (from.fullPath) saveScroll(from.fullPath)
      return true
    })

    router.afterEach(async (to) => {
      await restoreScroll(to.fullPath)
    })

    window.addEventListener('beforeunload', () => {
      const current = router.currentRoute.value
      saveScroll(current.fullPath)
    })

    window.addEventListener('popstate', () => {
      const current = router.currentRoute.value
      void restoreScroll(current.fullPath)
    })
  })
}
