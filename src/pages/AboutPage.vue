<script setup lang="ts">
import { ref, onMounted } from 'vue'

const fontSize = ref(16)

onMounted(() => {
  const saved = localStorage.getItem('ykhn-font-size')
  if (saved) {
    fontSize.value = Number.parseInt(saved)
    applyFontSize()
  }
})

function updateFontSize(delta: number) {
  fontSize.value = Math.max(12, Math.min(24, fontSize.value + delta))
  localStorage.setItem('ykhn-font-size', fontSize.value.toString())
  applyFontSize()
}

function applyFontSize() {
  document.documentElement.style.setProperty('--tui-font-size', `${fontSize.value}px`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="border-b border-retro-border pb-4">
      <h1 class="text-4xl font-black uppercase tracking-widest">
        SYS_INFO / ABOUT
      </h1>
      <p class="mt-2 opacity-70">
        YKHN_TERMINAL V1.0 - SECURE ACCESS GRANTED
      </p>
    </header>

    <div class="retro-border">
      <h2 class="text-xl font-bold mb-4 uppercase">>> PROJECT_OVERVIEW</h2>
      <p class="mb-4">
        YKHN IS A HIGH-PERFORMANCE, OFFLINE-ENABLED INTERFACE FOR THE HACKER_NEWS MAINFRAME.
      </p>
      <p class="mb-4">
        BUILT USING MODERN PROTOCOLS: BUN, VITE, VUE, AND TAILWIND_CSS.
      </p>
    </div>

    <div class="retro-border bg-tui-active/20">
      <h2 class="text-xl font-bold mb-4 uppercase">>> SYS_CONFIGURATION</h2>
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span>FONT_SIZE:</span>
          <div class="flex border border-tui-border">
            <button class="px-3 py-1 bg-tui-gray text-tui-bg hover:bg-tui-cyan" @click="updateFontSize(-1)">-</button>
            <div class="px-4 py-1 bg-tui-bg text-tui-cyan">{{ fontSize }}PX</div>
            <button class="px-3 py-1 bg-tui-gray text-tui-bg hover:bg-tui-cyan" @click="updateFontSize(1)">+</button>
          </div>
        </div>
      </div>
    </div>

    <div class="retro-border bg-tui-active/10">
      <h2 class="text-xl font-bold mb-4 uppercase">>> CACHING_SUBSYSTEM</h2>
      <p>
        DATA PERSISTENCE IS AUTOMATICALLY MANAGED. FEED INDEXES AND STORY CONTENT ARE STORED IN LOCAL_BUFFER FOR RETRIEVAL DURING NETWORK_INTERRUPTIONS.
      </p>
    </div>

    <div class="retro-border">
      <h2 class="text-xl font-bold mb-4 uppercase">>> DATA_SOURCE</h2>
      <p>
        PRIMARY UPLINK: OFFICIAL HACKER_NEWS FIREBASE_API.
      </p>
    </div>

    <div class="mt-8 text-center text-xs opacity-50 animate-pulse">
      [END OF TRANSMISSION]
    </div>
  </div>
</template>
