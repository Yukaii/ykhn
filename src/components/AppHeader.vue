<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useOnline } from '../composables/useOnline'
import { menuState } from '../store'

const { online } = useOnline()
const router = useRouter()

const sysMenuOpen = ref(false)
const actionsMenuOpen = ref(false)
const helpMenuOpen = ref(false)

function toggleSysMenu() {
  sysMenuOpen.value = !sysMenuOpen.value
  actionsMenuOpen.value = false
  helpMenuOpen.value = false
}

function toggleActionsMenu() {
  actionsMenuOpen.value = !actionsMenuOpen.value
  sysMenuOpen.value = false
  helpMenuOpen.value = false
}

function toggleHelpMenu() {
  helpMenuOpen.value = !helpMenuOpen.value
  sysMenuOpen.value = false
  actionsMenuOpen.value = false
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

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  closeMenus()
}

function runAction(action: () => void, disabled?: boolean) {
  if (disabled) return
  action()
  closeMenus()
}

// Close menu when clicking outside
const onWindowClick = (e: MouseEvent) => {
  if ((sysMenuOpen.value || actionsMenuOpen.value || helpMenuOpen.value) && !(e.target as HTMLElement).closest('.tui-menu-container')) {
    closeMenus()
  }
}

const onCloseMenus = () => closeMenus()

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('ykhn:close-menus', onCloseMenus as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('ykhn:close-menus', onCloseMenus as EventListener)
})
</script>

<template>
  <div class="flex flex-col flex-none select-none">
    <!-- Title Bar -->
    <div class="tui-title-bar">
      <div class="flex items-center gap-2 tui-menu-container relative">
        <button 
          @click.stop="toggleSysMenu" 
          class="bg-tui-bg text-tui-cyan px-2 hover:bg-tui-cyan hover:text-tui-bg transition-none font-bold"
          :class="sysMenuOpen ? 'bg-tui-cyan text-tui-bg' : ''"
        >
          ≡
        </button>
        <RouterLink to="/" class="hover:bg-tui-bg hover:text-tui-cyan px-1 transition-none">
          YKHN_OS V1.0
        </RouterLink>

        <!-- System Dropdown Menu -->
        <div v-if="sysMenuOpen" class="tui-menu-dropdown font-mono text-tui-bg left-0 top-full mt-[2px]">
          <div class="tui-dropdown-item" @click="navigate('/')">
            <span>TOP_STORIES</span>
            <span class="opacity-50">F1</span>
          </div>
          <div class="tui-dropdown-item" @click="navigate('/new')">
            <span>NEW_STORIES</span>
            <span class="opacity-50">F2</span>
          </div>
          <div class="tui-dropdown-item border-b border-tui-bg/20"></div>
          <div class="tui-dropdown-item" @click="navigate('/about')">
            <span>SYSTEM_SETUP</span>
            <span class="opacity-50">F9</span>
          </div>
          <div class="tui-dropdown-item" @click="reboot">
            <span>REBOOT_OS</span>
            <span class="opacity-50">^R</span>
          </div>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <span :class="online ? 'text-tui-bg' : 'bg-red-600 text-white px-1'">
          {{ online ? '[ONLINE]' : '[OFFLINE]' }}
        </span>
        <span class="hidden md:inline opacity-70">C:\HN\STORIES\</span>
      </div>
    </div>

    <!-- Menu Bar -->
    <div class="tui-menu-bar tui-menu-container">
      <div class="tui-menu-item" @click.stop="toggleActionsMenu" :class="actionsMenuOpen ? 'bg-tui-bg text-tui-cyan' : ''">
        <u>A</u>ctions
        <!-- Actions Dropdown -->
        <div v-if="actionsMenuOpen" class="tui-menu-dropdown left-0 top-full">
          <template v-if="menuState.actions.length">
            <div 
              v-for="item in menuState.actions" 
              :key="item.label" 
              class="tui-dropdown-item"
              :class="item.disabled ? 'opacity-30 cursor-not-allowed' : ''"
              @click="runAction(item.action, item.disabled)"
            >
              <span class="font-bold">{{ item.label.toUpperCase() }}</span>
              <span v-if="item.shortcut" class="opacity-60">{{ item.shortcut }}</span>
            </div>
          </template>
          <div v-else class="px-4 py-2 opacity-50 italic">NO_ACTIONS</div>
        </div>
      </div>
      <div class="tui-menu-item text-black/50"><u>E</u>dit</div>
      <div class="tui-menu-item" @click.stop="toggleHelpMenu" :class="helpMenuOpen ? 'bg-tui-bg text-tui-cyan' : ''">
        <u>H</u>elp
        <!-- Help Dropdown -->
        <div v-if="helpMenuOpen" class="tui-menu-dropdown left-0 top-full">
          <div class="tui-dropdown-item" @click="navigate('/about')">
            <span class="font-bold">ABOUT</span>
            <span class="opacity-60">F9</span>
          </div>
          <div class="tui-dropdown-item" @click="openExternal('https://github.com/Yukaii/ykhn')">
            <span class="font-bold">OPEN_REPO</span>
            <span class="opacity-60">WEB</span>
          </div>
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
