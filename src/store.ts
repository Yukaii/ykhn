import { reactive } from 'vue'

export const menuState = reactive({
  actions: [] as { label: string; action: () => void; shortcut?: string; disabled?: boolean }[],
  title: '',
  loading: false
})

export function setMenuActions(actions: typeof menuState.actions) {
  menuState.actions = actions
}

export function setMenuTitle(title: string) {
  menuState.title = title
}

export function setLoading(loading: boolean) {
  menuState.loading = loading
}

export const uiState = reactive({
  shortcutsOpen: false,
})

export function setShortcutsOpen(open: boolean) {
  uiState.shortcutsOpen = open
}

export function toggleShortcuts() {
  uiState.shortcutsOpen = !uiState.shortcutsOpen
}
