import { useLocalStorage } from '@vueuse/core'
import { computed, reactive, watch } from 'vue'
import { fetchAuthList, fetchCurrentSession } from './api/auth'
import type { AuthSession } from './api/auth'
import {
  isBuiltInTheme,
  isInstalledTheme,
  type BuiltInTheme,
  type InstalledTheme,
} from './lib/themes'

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

export type Theme = BuiltInTheme | `open-vsx:${string}`
export type FontMode = 'readable' | 'balanced' | 'retro'
export type JoystickDock = 'right' | 'left'
export type JoystickPosition = { top: number; dock: JoystickDock }

const themeStorageKey = 'ykhn-theme'
const storedTheme = useLocalStorage<string>(themeStorageKey, 'commander')

const installedThemesStorageKey = 'ykhn-installed-themes'
const storedInstalledThemes = useLocalStorage<InstalledTheme[]>(installedThemesStorageKey, [])

export const installedThemes = computed<InstalledTheme[]>(() => {
  const value: unknown = storedInstalledThemes.value
  return Array.isArray(value) ? value.filter(isInstalledTheme) : []
})

const fontModeStorageKey = 'ykhn-font-mode'
const storedFontMode = useLocalStorage<string>(fontModeStorageKey, 'balanced')

const joystickDockStorageKey = 'ykhn-joystick-dock'
const storedJoystickDock = useLocalStorage<string>(joystickDockStorageKey, 'right')

const joystickPositionStorageKey = 'ykhn-joystick-position'
const storedJoystickPosition = useLocalStorage<JoystickPosition | null>(
  joystickPositionStorageKey,
  null,
)

const joystickCollapsedStorageKey = 'ykhn-joystick-collapsed'
const storedJoystickCollapsed = useLocalStorage<boolean>(joystickCollapsedStorageKey, false)

export const uiState = reactive({
  shortcutsOpen: false,
  theme: 'commander' as Theme,
  fontMode: 'balanced' as FontMode,
  joystickDock: 'right' as JoystickDock,
  joystickPosition: null as JoystickPosition | null,
  joystickCollapsed: false,
})

const authTokenStorageKey = 'ykhn-auth-token'
const authUserStorageKey = 'ykhn-auth-user'
const authExpiresStorageKey = 'ykhn-auth-expires-at'

const storedAuthToken = useLocalStorage<string | null>(authTokenStorageKey, null)
const storedAuthUser = useLocalStorage<string | null>(authUserStorageKey, null)
const storedAuthExpiresAt = useLocalStorage<number | null>(authExpiresStorageKey, null)

export const authState = reactive({
  token: storedAuthToken.value,
  userId: storedAuthUser.value,
  expiresAt: storedAuthExpiresAt.value,
  initialized: false,
  checking: false,
  loadingVotes: false,
  upvotedSubmissionIds: new Set<number>(),
  upvotedCommentIds: new Set<number>(),
})

export const isAuthenticated = () => !!authState.token && !!authState.userId && !isAuthExpired()

function isAuthExpired() {
  return (
    typeof authState.expiresAt === 'number' && authState.expiresAt <= Math.floor(Date.now() / 1000)
  )
}

export function setAuthSession(session: AuthSession) {
  authState.token = session.token
  authState.userId = session.user.id
  authState.expiresAt = session.expiresAt

  storedAuthToken.value = session.token
  storedAuthUser.value = session.user.id
  storedAuthExpiresAt.value = session.expiresAt

  void refreshUpvotedSnapshot()
}

export function clearAuthSession() {
  authState.token = null
  authState.userId = null
  authState.expiresAt = null
  authState.upvotedSubmissionIds.clear()
  authState.upvotedCommentIds.clear()

  storedAuthToken.value = null
  storedAuthUser.value = null
  storedAuthExpiresAt.value = null
}

export function setUpvotedItem(id: number, type: 'story' | 'comment', voted: boolean) {
  const set = type === 'comment' ? authState.upvotedCommentIds : authState.upvotedSubmissionIds
  if (voted) set.add(id)
  else set.delete(id)
}

export function isItemUpvoted(id: number, type: 'story' | 'comment' = 'story') {
  return type === 'comment'
    ? authState.upvotedCommentIds.has(id)
    : authState.upvotedSubmissionIds.has(id)
}

export async function refreshUpvotedSnapshot(options?: { pages?: number }) {
  const token = authState.token
  if (!token || authState.loadingVotes) return

  const pages = options?.pages ?? 3
  authState.loadingVotes = true

  try {
    const submissionIds = new Set<number>()
    const commentIds = new Set<number>()

    for (let page = 1; page <= pages; page++) {
      const [submissions, comments] = await Promise.all([
        fetchAuthList('upvoted-submissions', token, page),
        fetchAuthList('upvoted-comments', token, page),
      ])

      for (const item of submissions.items) submissionIds.add(item.id)
      for (const item of comments.items) commentIds.add(item.id)

      if (!submissions.nextPage && !comments.nextPage) break
    }

    authState.upvotedSubmissionIds = submissionIds
    authState.upvotedCommentIds = commentIds
  } catch {
    // Keep any previously-known vote state; account pages expose exact errors.
  } finally {
    authState.loadingVotes = false
  }
}

export async function initAuthFromStorage() {
  if (authState.initialized || authState.checking) return

  if (!authState.token || isAuthExpired()) {
    clearAuthSession()
    authState.initialized = true
    return
  }

  authState.checking = true
  try {
    const me = await fetchCurrentSession(authState.token)
    authState.userId = me.user.id
    authState.expiresAt = me.session.expiresAt
    storedAuthUser.value = me.user.id
    storedAuthExpiresAt.value = me.session.expiresAt
    void refreshUpvotedSnapshot()
  } catch {
    clearAuthSession()
  } finally {
    authState.checking = false
    authState.initialized = true
  }
}

function isTheme(value: unknown): value is Theme {
  return (
    isBuiltInTheme(value) ||
    (typeof value === 'string' && installedThemes.value.some((theme) => theme.id === value))
  )
}

function isFontMode(value: unknown): value is FontMode {
  return value === 'readable' || value === 'balanced' || value === 'retro'
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
  const root = document.documentElement
  const customProperties = [
    '--color-tui-bg',
    '--color-tui-text',
    '--color-tui-border',
    '--color-tui-gray',
    '--color-tui-active',
    '--color-tui-cyan',
    '--color-tui-yellow',
  ]
  for (const property of customProperties) root.style.removeProperty(property)

  if (isBuiltInTheme(theme)) {
    root.dataset.theme = theme
    root.dataset.themeAppearance = theme === 'light' ? 'light' : 'dark'
    return
  }

  const installed = installedThemes.value.find((candidate) => candidate.id === theme)
  if (!installed) return
  root.dataset.theme = 'custom'
  root.dataset.themeAppearance = installed.appearance
  root.style.setProperty('--color-tui-bg', installed.colors.background)
  root.style.setProperty('--color-tui-text', installed.colors.text)
  root.style.setProperty('--color-tui-border', installed.colors.border)
  root.style.setProperty('--color-tui-gray', installed.colors.gray)
  root.style.setProperty('--color-tui-active', installed.colors.active)
  root.style.setProperty('--color-tui-cyan', installed.colors.cyan)
  root.style.setProperty('--color-tui-yellow', installed.colors.yellow)
}

function applyFontModeToDom(mode: FontMode) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.font = mode
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
  { immediate: true },
)

watch(
  storedFontMode,
  (value) => {
    if (isFontMode(value)) {
      uiState.fontMode = value
      applyFontModeToDom(value)
      return
    }

    storedFontMode.value = uiState.fontMode
    applyFontModeToDom(uiState.fontMode)
  },
  { immediate: true },
)

watch(
  installedThemes,
  () => {
    if (!isTheme(uiState.theme)) {
      setTheme('commander')
      return
    }
    applyThemeToDom(uiState.theme)
  },
  { deep: true },
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
  { immediate: true },
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
      if (
        typeof top === 'number' &&
        Number.isFinite(top) &&
        typeof left === 'number' &&
        Number.isFinite(left)
      ) {
        uiState.joystickPosition = { top, dock: uiState.joystickDock }
        storedJoystickPosition.value = uiState.joystickPosition
        return
      }
    }

    storedJoystickPosition.value = uiState.joystickPosition
  },
  { immediate: true },
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
  { immediate: true },
)

export function initThemeFromStorage() {
  applyThemeToDom(uiState.theme)
  applyFontModeToDom(uiState.fontMode)
}

export function setTheme(theme: Theme) {
  if (!isTheme(theme)) return
  uiState.theme = theme
  storedTheme.value = theme
  applyThemeToDom(theme)
}

export function replaceInstalledThemeCollection(themes: ReadonlyArray<InstalledTheme>) {
  if (themes.length === 0 || themes.some((theme) => !isInstalledTheme(theme))) {
    throw new Error('The imported theme collection is invalid.')
  }
  const id = themes[0]!.collection.id
  if (themes.some((theme) => theme.collection.id !== id)) {
    throw new Error('The imported themes do not belong to one collection.')
  }

  const next = [...installedThemes.value.filter((theme) => theme.collection.id !== id), ...themes]
  if (new Set(next.map((theme) => theme.id)).size !== next.length) {
    throw new Error('An imported theme conflicts with an installed theme.')
  }
  storedInstalledThemes.value = next
}

export function removeInstalledThemeCollection(collectionId: string) {
  const removedIds = new Set<string>(
    installedThemes.value
      .filter((theme) => theme.collection.id === collectionId)
      .map((theme) => theme.id),
  )
  if (removedIds.size === 0) return
  storedInstalledThemes.value = installedThemes.value.filter(
    (theme) => theme.collection.id !== collectionId,
  )
  if (removedIds.has(uiState.theme)) setTheme('commander')
}

export function setFontMode(mode: FontMode) {
  uiState.fontMode = mode
  storedFontMode.value = mode
  applyFontModeToDom(mode)
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
  { immediate: true },
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
