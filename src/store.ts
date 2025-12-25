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
export type JoystickDock = 'right' | 'left'
export type JoystickPosition = { top: number; dock: JoystickDock }

const themeStorageKey = 'ykhn-theme'
const storedTheme = useLocalStorage<string>(themeStorageKey, 'commander')

const joystickDockStorageKey = 'ykhn-joystick-dock'
const storedJoystickDock = useLocalStorage<string>(joystickDockStorageKey, 'right')

const joystickPositionStorageKey = 'ykhn-joystick-position'
const storedJoystickPosition = useLocalStorage<JoystickPosition | null>(joystickPositionStorageKey, null)

const joystickCollapsedStorageKey = 'ykhn-joystick-collapsed'
const storedJoystickCollapsed = useLocalStorage<boolean>(joystickCollapsedStorageKey, false)

export const uiState = reactive({
  shortcutsOpen: false,
  theme: 'commander' as Theme,
  joystickDock: 'right' as JoystickDock,
  joystickPosition: null as JoystickPosition | null,
  joystickCollapsed: false,
})


function isTheme(value: unknown): value is Theme {
  return value === 'commander' || value === 'dark' || value === 'light'
}

function isJoystickDock(value: unknown): value is JoystickDock {
  return value === 'left' || value === 'right'
}

function isJoystickPosition(value: unknown): value is JoystickPosition {
  if (typeof value !== 'object' || !value) return false
  const v = value as Record<string, unknown>
  const top = v.top
  const dock = v.dock
  return typeof top === 'number' && Number.isFinite(top) && (dock === 'left' || dock === 'right')
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

watch(
  storedJoystickDock,
  (value) => {
    if (isJoystickDock(value)) {
      uiState.joystickDock = value
      return
    }

    storedJoystickDock.value = uiState.joystickDock
  },
  { immediate: true }
)

watch(
  storedJoystickPosition,
  (value) => {
    if (value == null) {
      uiState.joystickPosition = null
      return
    }

    const raw = value as unknown

    if (isJoystickPosition(raw)) {
      uiState.joystickPosition = raw
      return
    }

    // Back-compat: previously stored as { left, top }.
    if (typeof raw === 'object' && raw) {
      const v = raw as Record<string, unknown>
      const top = v.top
      const left = v.left
      if (typeof top === 'number' && Number.isFinite(top) && typeof left === 'number' && Number.isFinite(left)) {
        uiState.joystickPosition = { top, dock: uiState.joystickDock }
        storedJoystickPosition.value = uiState.joystickPosition
        return
      }
    }

    storedJoystickPosition.value = uiState.joystickPosition
  },
  { immediate: true }
)

watch(
  storedJoystickCollapsed,
  (value) => {
    if (typeof value === 'boolean') {
      uiState.joystickCollapsed = value
      return
    }

    storedJoystickCollapsed.value = uiState.joystickCollapsed
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

export function setJoystickDock(dock: JoystickDock) {
  uiState.joystickDock = dock
  storedJoystickDock.value = dock

  // Keep the persisted position's dock in sync.
  if (uiState.joystickPosition) {
    setJoystickPosition({ ...uiState.joystickPosition, dock })
  }
}

export function setJoystickPosition(pos: JoystickPosition | null) {
  uiState.joystickPosition = pos
  storedJoystickPosition.value = pos
}

export function resetJoystickPosition() {
  setJoystickPosition(null)
}

export function setJoystickCollapsed(collapsed: boolean) {
  uiState.joystickCollapsed = collapsed
  storedJoystickCollapsed.value = collapsed
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
