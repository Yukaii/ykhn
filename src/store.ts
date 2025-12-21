import { useLocalStorage } from '@vueuse/core'
import { reactive, watch } from 'vue'

export const menuState = reactive({
  actions: [] as { label: string; action: () => void; shortcut?: string; disabled?: boolean }[],
  title: '',
  loading: false,
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
const storedTheme = useLocalStorage<string>(themeStorageKey, 'commander')

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

watch(
  storedTheme,
  (value) => {
    if (isTheme(value)) {
      uiState.theme = value
      applyThemeToDom(value)
      return
    }

    storedTheme.value = uiState.theme
    applyThemeToDom(uiState.theme)
  },
  { immediate: true }
)

export function initThemeFromStorage() {
  applyThemeToDom(uiState.theme)
}

export function setTheme(theme: Theme) {
  uiState.theme = theme
  storedTheme.value = theme
  applyThemeToDom(theme)
}

const fontSizeStorageKey = 'ykhn-font-size'
export const fontSizePx = useLocalStorage<number>(fontSizeStorageKey, 16)

function applyFontSizeToDom(px: number) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--tui-font-size', `${px}px`)
}

watch(
  fontSizePx,
  (value) => {
    const px = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(px) || px <= 0) return
    applyFontSizeToDom(px)
  },
  { immediate: true }
)

export function setFontSizePx(px: number) {
  fontSizePx.value = px
}

export function setShortcutsOpen(open: boolean) {
  uiState.shortcutsOpen = open
}

export function toggleShortcuts() {
  uiState.shortcutsOpen = !uiState.shortcutsOpen
}
