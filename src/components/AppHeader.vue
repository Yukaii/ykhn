<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useOnline } from '../composables/useOnline'
import { menuState } from '../store'

const { online } = useOnline()
const router = useRouter()

const sysMenuOpen = ref(false)
const actionsMenuOpen = ref(false)

function toggleSysMenu() {
  sysMenuOpen.value = !sysMenuOpen.value
  actionsMenuOpen.value = false
}

function toggleActionsMenu() {
  actionsMenuOpen.value = !actionsMenuOpen.value
  sysMenuOpen.value = false
}

function closeMenus() {
  sysMenuOpen.value = false
  actionsMenuOpen.value = false
}

function navigate(path: string) {
  router.push(path)
  closeMenus()
}

function reboot() {
  window.location.reload()
}

function runAction(action: () => void, disabled?: boolean) {
  if (disabled) return
  action()
  closeMenus()
}

// Close menu when clicking outside
const onWindowClick = (e: MouseEvent) => {
  if ((sysMenuOpen.value || actionsMenuOpen.value) && !(e.target as HTMLElement).closest('.tui-menu-container')) {
    closeMenus()
  }
}

onMounted(() => window.addEventListener('click', onWindowClick))
onUnmounted(() => window.removeEventListener('click', onWindowClick))
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
        <span :class="online ? 'text-tui-bg' : 'bg-red-600 text-white px-1 animate-pulse'">
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
              <span>{{ item.label.toUpperCase() }}</span>
              <span v-if="item.shortcut" class="opacity-50">{{ item.shortcut }}</span>
            </div>
          </template>
          <div v-else class="px-4 py-2 opacity-30 italic">NO_ACTIONS</div>
        </div>
      </div>
      <div class="tui-menu-item opacity-30"><u>E</u>dit</div>
      <div class="tui-menu-item opacity-30"><u>H</u>elp</div>
      
      <div class="ml-auto px-4 py-0.5 opacity-60 font-mono flex items-center gap-2">
        {{ menuState.title }}
      </div>
    </div>
  </div>
</template>
