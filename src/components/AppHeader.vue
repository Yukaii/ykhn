<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { nextTick, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useOnline } from '../composables/useOnline'
import { shouldIgnoreKeyboardEvent } from '../lib/keyboard'
import { menuState, setTheme, uiState, type Theme } from '../store'

const { online } = useOnline()
const router = useRouter()

type MenuName = 'sys' | 'actions' | 'help'

const sysMenuOpen = ref(false)
const actionsMenuOpen = ref(false)
const helpMenuOpen = ref(false)

const mnemonicMode = ref(false)

const sysTriggerEl = ref<HTMLButtonElement | null>(null)
const actionsTriggerEl = ref<HTMLButtonElement | null>(null)
const helpTriggerEl = ref<HTMLButtonElement | null>(null)

const sysMenuEl = ref<HTMLElement | null>(null)
const actionsMenuEl = ref<HTMLElement | null>(null)
const helpMenuEl = ref<HTMLElement | null>(null)

function getTriggerEl(menu: MenuName) {
  if (menu === 'sys') return sysTriggerEl.value
  if (menu === 'actions') return actionsTriggerEl.value
  return helpTriggerEl.value
}

function getMenuEl(menu: MenuName) {
  if (menu === 'sys') return sysMenuEl.value
  if (menu === 'actions') return actionsMenuEl.value
  return helpMenuEl.value
}

function focusTrigger(menu: MenuName) {
  getTriggerEl(menu)?.focus()
}

function getFocusableMenuItems(menuEl: HTMLElement | null) {
  if (!menuEl) return []
  return Array.from(
    menuEl.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]):not([disabled])')
  )
}

async function focusMenuEdge(menu: MenuName, edge: 'first' | 'last') {
  await nextTick()
  const items = getFocusableMenuItems(getMenuEl(menu))
  const el = edge === 'first' ? items[0] : items[items.length - 1]
  el?.focus()
}

function onMenuKeydown(menu: MenuName, e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeMenus()
    focusTrigger(menu)
    e.preventDefault()
    e.stopPropagation()
    return
  }

  const shouldHandle = e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End'
  if (!shouldHandle) return

  const items = getFocusableMenuItems(getMenuEl(menu))
  if (items.length === 0) return

  const active = document.activeElement as HTMLElement | null
  const currentIndex = active ? items.indexOf(active) : -1

  let nextIndex = 0
  if (e.key === 'Home') nextIndex = 0
  else if (e.key === 'End') nextIndex = items.length - 1
  else if (e.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
  else if (e.key === 'ArrowUp') nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length

  items[nextIndex]?.focus()
  e.preventDefault()
  e.stopPropagation()
}

async function onTriggerKeydown(menu: MenuName, e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (menu === 'sys') toggleSysMenu()
    if (menu === 'actions') toggleActionsMenu()
    if (menu === 'help') toggleHelpMenu()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (menu === 'sys' && !sysMenuOpen.value) toggleSysMenu()
    if (menu === 'actions' && !actionsMenuOpen.value) toggleActionsMenu()
    if (menu === 'help' && !helpMenuOpen.value) toggleHelpMenu()
    await focusMenuEdge(menu, 'first')
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (menu === 'sys' && !sysMenuOpen.value) toggleSysMenu()
    if (menu === 'actions' && !actionsMenuOpen.value) toggleActionsMenu()
    if (menu === 'help' && !helpMenuOpen.value) toggleHelpMenu()
    await focusMenuEdge(menu, 'last')
  }
}

function openMenu(menu: MenuName) {
  sysMenuOpen.value = menu === 'sys'
  actionsMenuOpen.value = menu === 'actions'
  helpMenuOpen.value = menu === 'help'
}

function toggleSysMenu() {
  if (sysMenuOpen.value) closeMenus()
  else openMenu('sys')
}

function toggleActionsMenu() {
  if (actionsMenuOpen.value) closeMenus()
  else openMenu('actions')
}

function toggleHelpMenu() {
  if (helpMenuOpen.value) closeMenus()
  else openMenu('help')
}

function closeMenus() {
  sysMenuOpen.value = false
  actionsMenuOpen.value = false
  helpMenuOpen.value = false
}

function navigate(path: string) {
  router.push(path)
  closeMenus()
}

function reboot() {
  window.location.reload()
}

function setThemeAndClose(theme: Theme) {
  setTheme(theme)
  closeMenus()
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  closeMenus()
}

function runAction(action: () => void, disabled?: boolean) {
  if (disabled) return
  action()
  closeMenus()
}

const onWindowClick = (e: MouseEvent) => {
  if ((sysMenuOpen.value || actionsMenuOpen.value || helpMenuOpen.value) && !(e.target as HTMLElement).closest('.tui-menu-container')) {
    closeMenus()
  }
}

const onCloseMenus = () => closeMenus()

const onWindowKeyDown = async (e: KeyboardEvent) => {
  if (uiState.shortcutsOpen) return

  if (e.key === 'Alt') {
    if (shouldIgnoreKeyboardEvent(e)) return
    mnemonicMode.value = true
    e.preventDefault()
    return
  }

  if (!mnemonicMode.value) return
  if (shouldIgnoreKeyboardEvent(e)) return

  const mnemonicKey = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.key
  const key = mnemonicKey.toLowerCase()
  const didSelect = key === 's' || key === 'a' || key === 'h'
  if (!didSelect) return

  e.preventDefault()
  e.stopPropagation()

  if (key === 's') {
    if (!sysMenuOpen.value) openMenu('sys')
    await focusMenuEdge('sys', 'first')
    return
  }

  if (key === 'a') {
    if (!actionsMenuOpen.value) openMenu('actions')
    await focusMenuEdge('actions', 'first')
    return
  }

  if (key === 'h') {
    if (!helpMenuOpen.value) openMenu('help')
    await focusMenuEdge('help', 'first')
  }
}

const onWindowKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Alt') mnemonicMode.value = false
}

useEventListener(window, 'click', onWindowClick)
useEventListener(window, 'keydown', onWindowKeyDown, { capture: true })
useEventListener(window, 'keyup', onWindowKeyUp, { capture: true })
useEventListener(window, 'ykhn:close-menus', onCloseMenus as EventListener)
</script>

<template>
  <div class="flex flex-col flex-none select-none">
    <!-- Title Bar -->
    <div class="tui-title-bar">
      <div class="flex items-center gap-2">
        <RouterLink to="/" class="hover:bg-tui-bg hover:text-tui-cyan px-1 transition-none">
          YKHN_OS V1.0
        </RouterLink>
      </div>
      
      <div class="flex items-center gap-4">
        <span :class="online ? 'text-tui-bg' : 'bg-red-600 text-white px-1'">
          {{ online ? '[ONLINE]' : '[OFFLINE]' }}
        </span>
        <span class="hidden md:inline opacity-70">C:\HN\STORIES\</span>
      </div>
    </div>

    <!-- Menu Bar -->
    <div class="tui-menu-bar tui-menu-container" role="menubar" aria-label="Main menu">
      <div class="relative">
        <button
          ref="sysTriggerEl"
          type="button"
          class="tui-menu-item flex items-center gap-1"
          :class="sysMenuOpen ? 'bg-tui-bg text-tui-cyan' : ''"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="sysMenuOpen"
          aria-controls="sys-menu"
          @click.stop="toggleSysMenu"
          @keydown="onTriggerKeydown('sys', $event)"
        >
          <span aria-hidden="true">≡</span>
          <span class="font-bold">
            <template v-if="mnemonicMode"><u>S</u>ystem</template>
            <template v-else>System</template>
          </span>
        </button>

        <!-- System Dropdown Menu -->
        <div
          v-if="sysMenuOpen"
          id="sys-menu"
          ref="sysMenuEl"
          class="tui-menu-dropdown tui-sys-menu font-mono left-0 top-full mt-[2px]"
          role="menu"
          aria-label="System"
          @keydown="onMenuKeydown('sys', $event)"
        >
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="navigate('/')">
            <span>TOP_STORIES</span>
            <span class="tui-shortcut">F1</span>
          </button>
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="navigate('/new')">
            <span>NEW_STORIES</span>
            <span class="tui-shortcut">F2</span>
          </button>
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="navigate('/search')">
            <span>SEARCH</span>
            <span class="tui-shortcut">F7</span>
          </button>
          <div role="separator" aria-orientation="horizontal" class="border-b border-tui-bg/20 mx-2 my-1"></div>
          <button
            type="button"
            class="tui-dropdown-item w-full text-left opacity-30 cursor-not-allowed"
            role="menuitem"
            disabled
            aria-disabled="true"
          >
            <span>EDIT</span>
            <span class="tui-shortcut">N/A</span>
          </button>
          <button
            type="button"
            class="tui-dropdown-item w-full text-left"
            role="menuitemradio"
            :aria-checked="uiState.theme === 'dark'"
            @click="setThemeAndClose('dark')"
          >
            <span>{{ uiState.theme === 'dark' ? '● ' : '  ' }}THEME_DARK</span>
            <span class="tui-shortcut">BW</span>
          </button>
          <button
            type="button"
            class="tui-dropdown-item w-full text-left"
            role="menuitemradio"
            :aria-checked="uiState.theme === 'light'"
            @click="setThemeAndClose('light')"
          >
            <span>{{ uiState.theme === 'light' ? '● ' : '  ' }}THEME_LIGHT</span>
            <span class="tui-shortcut">WB</span>
          </button>
          <button
            type="button"
            class="tui-dropdown-item w-full text-left"
            role="menuitemradio"
            :aria-checked="uiState.theme === 'commander'"
            @click="setThemeAndClose('commander')"
          >
            <span>{{ uiState.theme === 'commander' ? '● ' : '  ' }}THEME_CMD</span>
            <span class="tui-shortcut">NC</span>
          </button>
          <div role="separator" aria-orientation="horizontal" class="border-b border-tui-bg/20 mx-2 my-1"></div>
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="navigate('/about')">
            <span>SYSTEM_SETUP</span>
            <span class="tui-shortcut">F9</span>
          </button>
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="reboot">
            <span>REBOOT_OS</span>
            <span class="tui-shortcut">^R</span>
          </button>
        </div>
      </div>

      <div class="relative">
        <button
          ref="actionsTriggerEl"
          type="button"
          class="tui-menu-item"
          :class="actionsMenuOpen ? 'bg-tui-bg text-tui-cyan' : ''"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="actionsMenuOpen"
          aria-controls="actions-menu"
          @click.stop="toggleActionsMenu"
          @keydown="onTriggerKeydown('actions', $event)"
        >
          <template v-if="mnemonicMode"><u>A</u>ctions</template>
          <template v-else>Actions</template>
        </button>
        <!-- Actions Dropdown -->
        <div
          v-if="actionsMenuOpen"
          id="actions-menu"
          ref="actionsMenuEl"
          class="tui-menu-dropdown left-0 top-full"
          role="menu"
          aria-label="Actions"
          @keydown="onMenuKeydown('actions', $event)"
        >
          <template v-if="menuState.actions.length">
            <button
              v-for="item in menuState.actions"
              :key="item.label"
              type="button"
              class="tui-dropdown-item w-full text-left"
              role="menuitem"
              :disabled="item.disabled"
              :aria-disabled="item.disabled ? 'true' : undefined"
              :class="item.disabled ? 'opacity-30 cursor-not-allowed' : ''"
              @click="runAction(item.action, item.disabled)"
            >
              <span class="font-bold">{{ item.label.toUpperCase() }}</span>
              <span v-if="item.shortcut" class="tui-shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
          <div v-else class="px-4 py-2 opacity-50 italic">NO_ACTIONS</div>
        </div>
      </div>

      <div class="relative">
        <button
          ref="helpTriggerEl"
          type="button"
          class="tui-menu-item"
          :class="helpMenuOpen ? 'bg-tui-bg text-tui-cyan' : ''"
          role="menuitem"
          aria-haspopup="menu"
          :aria-expanded="helpMenuOpen"
          aria-controls="help-menu"
          @click.stop="toggleHelpMenu"
          @keydown="onTriggerKeydown('help', $event)"
        >
          <template v-if="mnemonicMode"><u>H</u>elp</template>
          <template v-else>Help</template>
        </button>
        <!-- Help Dropdown -->
        <div
          v-if="helpMenuOpen"
          id="help-menu"
          ref="helpMenuEl"
          class="tui-menu-dropdown left-0 top-full"
          role="menu"
          aria-label="Help"
          @keydown="onMenuKeydown('help', $event)"
        >
          <button type="button" class="tui-dropdown-item w-full text-left" role="menuitem" @click="navigate('/about')">
            <span class="font-bold">ABOUT</span>
            <span class="tui-shortcut">F9</span>
          </button>
          <button
            type="button"
            class="tui-dropdown-item w-full text-left"
            role="menuitem"
            @click="openExternal('https://github.com/Yukaii/ykhn')"
          >
            <span class="font-bold">OPEN_REPO</span>
            <span class="tui-shortcut">WEB</span>
          </button>
        </div>
      </div>
      
      <div class="ml-auto px-4 py-0.5 opacity-100 font-mono flex items-center gap-2 whitespace-nowrap min-w-0">
        <div v-if="menuState.loading" class="text-tui-bg flex items-center gap-1 mr-1 shrink-0">
          <span class="hidden md:inline font-bold">WORKING...</span>
          <span class="md:hidden font-bold">BUSY</span>
          <div class="flex gap-0.5">
            <div class="w-1 h-3 bg-tui-bg animate-[step-end_1s_infinite]"></div>
          </div>
        </div>
        <span class="truncate font-bold">{{ menuState.title }}</span>
      </div>
    </div>
  </div>
</template>
