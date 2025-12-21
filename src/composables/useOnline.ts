import { useOnline as useVueUseOnline } from '@vueuse/core'

export function useOnline() {
  const online = useVueUseOnline()
  return { online }
}
