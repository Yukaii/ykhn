import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useOnline() {
  const online = ref(navigator.onLine)

  const sync = () => {
    online.value = navigator.onLine
  }

  onMounted(() => {
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', sync)
    window.removeEventListener('offline', sync)
  })

  return { online }
}
