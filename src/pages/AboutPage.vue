<script setup lang="ts">
import { computed } from 'vue'
import ThemeBrowser from '../components/ThemeBrowser.vue'
import { styleThemes, type StyleTheme } from '../lib/themes'
import {
  fontSizePx,
  setFontMode,
  setFontSizePx,
  setStyleTheme,
  setTheme,
  uiState,
  type FontMode,
  type Theme,
} from '../store'

const fontSize = fontSizePx

const theme = computed(() => uiState.theme)
const styleTheme = computed(() => uiState.styleTheme)
const fontMode = computed(() => uiState.fontMode)

function setThemeLocal(next: Theme) {
  setTheme(next)
}

function setStyleThemeLocal(next: StyleTheme) {
  setStyleTheme(next)
}

function setFontModeLocal(next: FontMode) {
  setFontMode(next)
}

function updateFontSize(delta: number) {
  const next = Math.max(12, Math.min(24, fontSize.value + delta))
  setFontSizePx(next)
}
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-5">
    <header class="border-b border-tui-active/50 pb-4">
      <h1 class="font-black uppercase">SYS_INFO / ABOUT</h1>
      <p class="mt-2 opacity-70">YKHN_TERMINAL V1.0 - SECURE ACCESS GRANTED</p>
    </header>

    <div class="tui-panel">
      <h2 class="font-bold mb-4 uppercase">>> PROJECT_OVERVIEW</h2>
      <p class="mb-3 leading-relaxed">
        YKHN IS A HIGH-PERFORMANCE, OFFLINE-ENABLED INTERFACE FOR THE HACKER_NEWS MAINFRAME. IT IS
        THE SUCCESSOR TO
        <a
          class="text-tui-cyan underline hover:bg-tui-cyan hover:text-tui-bg px-1"
          href="https://github.com/Yukaii/vimify-hackernews"
          target="_blank"
          rel="noopener noreferrer"
        >
          GITHUB.COM/YUKAII/VIMIFY-HACKERNEWS
        </a>
        AND A RETAKE ON THE SAME TOPIC.
      </p>
      <p class="mb-3 leading-relaxed">
        BUILT USING MODERN PROTOCOLS: BUN, VITE, VUE, AND TAILWIND_CSS.
      </p>
      <p class="leading-relaxed break-words">
        SOURCE_CODE:
        <a
          class="text-tui-cyan underline hover:bg-tui-cyan hover:text-tui-bg px-1"
          href="https://github.com/Yukaii/ykhn"
          target="_blank"
          rel="noopener noreferrer"
        >
          GITHUB.COM/YUKAII/YKHN
        </a>
      </p>
    </div>

    <ThemeBrowser />

    <div class="tui-panel-muted">
      <h2 class="font-bold mb-4 uppercase">>> SYS_CONFIGURATION</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>FONT_SIZE:</span>
          <div
            class="flex border border-tui-border rounded-[var(--ykhn-radius-sm)] overflow-hidden"
          >
            <button
              class="px-3 py-1 bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg font-bold"
              type="button"
              @click="updateFontSize(-1)"
            >
              -
            </button>
            <div class="px-4 py-1 bg-tui-bg text-tui-cyan min-w-20 text-center font-mono font-bold">
              {{ fontSize }}PX
            </div>
            <button
              class="px-3 py-1 bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg font-bold"
              type="button"
              @click="updateFontSize(1)"
            >
              +
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>COLOR_THEME:</span>
          <div
            class="grid grid-cols-4 border border-tui-border rounded-[var(--ykhn-radius-sm)] overflow-hidden"
          >
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                theme === 'commander'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setThemeLocal('commander')"
            >
              CMD
            </button>
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                theme === 'dark'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setThemeLocal('dark')"
            >
              DARK
            </button>
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                theme === 'light'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setThemeLocal('light')"
            >
              LIGHT
            </button>
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                theme === 'hackernews'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setThemeLocal('hackernews')"
            >
              HN
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>LOOK_AND_FEEL:</span>
          <div
            class="grid grid-cols-3 sm:grid-cols-6 border border-tui-border rounded-[var(--ykhn-radius-sm)] overflow-hidden"
          >
            <button
              v-for="style in styleThemes"
              :key="style.id"
              class="px-2 py-1 text-xs uppercase sm:text-sm transition-colors"
              :class="
                styleTheme === style.id
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              :title="style.description"
              @click="setStyleThemeLocal(style.id)"
            >
              {{ style.label }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>READING_FONT:</span>
          <div
            class="grid grid-cols-3 border border-tui-border rounded-[var(--ykhn-radius-sm)] overflow-hidden"
          >
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                fontMode === 'readable'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setFontModeLocal('readable')"
            >
              READ
            </button>
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                fontMode === 'balanced'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setFontModeLocal('balanced')"
            >
              BAL
            </button>
            <button
              class="px-3 py-1 uppercase transition-colors"
              :class="
                fontMode === 'retro'
                  ? 'bg-tui-cyan text-tui-bg font-bold'
                  : 'bg-tui-active/30 text-tui-text hover:bg-tui-cyan hover:text-tui-bg'
              "
              type="button"
              @click="setFontModeLocal('retro')"
            >
              RETRO
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="tui-panel-muted">
      <h2 class="font-bold mb-4 uppercase">>> CACHING_SUBSYSTEM</h2>
      <p class="leading-relaxed">
        DATA PERSISTENCE IS AUTOMATICALLY MANAGED. FEED INDEXES AND STORY CONTENT ARE STORED IN
        LOCAL_BUFFER FOR RETRIEVAL DURING NETWORK_INTERRUPTIONS.
      </p>
    </div>

    <div class="tui-panel">
      <h2 class="font-bold mb-4 uppercase">>> DATA_SOURCE</h2>
      <p class="leading-relaxed">PRIMARY UPLINK: OFFICIAL HACKER_NEWS FIREBASE_API.</p>
    </div>

    <div class="mt-8 text-center opacity-50 animate-pulse uppercase">[END OF TRANSMISSION]</div>
  </div>
</template>
