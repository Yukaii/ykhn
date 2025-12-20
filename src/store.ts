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

export type Theme = 'commander' | 'dark' | 'light'

const themeStorageKey = 'ykhn-theme'

export const uiState = reactive({
  shortcutsOpen: false,
  theme: 'commander' as Theme,
})

function isTheme(value: unknown): value is Theme {
  return value === 'commander' || value === 'dark' || value === 'light'
}

function applyThemeToDom(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function initThemeFromStorage() {
  try {
    const saved = localStorage.getItem(themeStorageKey)
    if (isTheme(saved)) uiState.theme = saved
  } catch {
    // ignore
  }

  applyThemeToDom(uiState.theme)
}

export function setTheme(theme: Theme) {
  uiState.theme = theme
  applyThemeToDom(theme)

  try {
    localStorage.setItem(themeStorageKey, theme)
  } catch {
    // ignore
  }
}

export function setShortcutsOpen(open: boolean) {
  uiState.shortcutsOpen = open
}

export function toggleShortcuts() {
  uiState.shortcutsOpen = !uiState.shortcutsOpen
}
