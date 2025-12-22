<script setup lang="ts">
import { computed } from 'vue'

import { menuState, setShortcutsOpen, uiState } from '../store'

const open = computed(() => uiState.shortcutsOpen)

function close() {
  setShortcutsOpen(false)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    @click="close"
  >
    <div
      class="w-full max-w-2xl bg-tui-bg border-4 border-double border-tui-border shadow-[8px_8px_0px_rgba(0,0,0,0.7)]"
      @click.stop
    >
      <div class="bg-tui-active text-tui-text px-3 py-2 font-black uppercase flex items-center">
        <span class="flex-1">KEYBOARD_SHORTCUTS</span>
        <button class="tui-btn" type="button" @click="close">[ESC]</button>
      </div>

      <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
        <div class="border border-tui-active/30 p-3">
          <div class="font-bold uppercase text-tui-cyan mb-2">Global</div>
          <div class="flex justify-between"><span>?</span><span>Toggle help</span></div>
          <div class="flex justify-between"><span>Esc</span><span>Close menus/help</span></div>
          <div class="flex justify-between"><span>Alt (hold)</span><span>Show menu underlines</span></div>
          <div class="flex justify-between"><span>Alt+S / A / H</span><span>Open System / Actions / Help</span></div>
          <div class="flex justify-between"><span>Alt+[underlined]</span><span>Activate menu entry</span></div>
          <div class="flex justify-between"><span>F1..F7</span><span>Switch modes</span></div>
          <div class="flex justify-between"><span>g1..g7</span><span>Go to mode</span></div>
          <div class="flex justify-between"><span>[ / ]</span><span>Prev/Next mode</span></div>
          <div class="flex justify-between"><span>F9</span><span>About</span></div>
          <div class="flex justify-between"><span>r</span><span>Refresh</span></div>
          <div class="flex justify-between"><span>/</span><span>Focus search (Search page)</span></div>
          <div class="flex justify-between"><span>PgUp/PgDn</span><span>Prev/Next (or load more)</span></div>
          <div class="flex justify-between"><span>Ctrl+o / Ctrl+i</span><span>Back / Forward</span></div>
          <div class="flex justify-between"><span>Ctrl+e / Ctrl+y</span><span>Scroll one row</span></div>
          <div class="flex justify-between"><span>Ctrl+d / Ctrl+u</span><span>Scroll half page</span></div>
          <div class="flex justify-between"><span>Ctrl+f / Ctrl+b</span><span>Scroll full page</span></div>
        </div>

        <div class="border border-tui-active/30 p-3">
          <div class="font-bold uppercase text-tui-cyan mb-2">Feed List</div>
          <div class="flex justify-between"><span>[count]j / [count]k</span><span>Move selection</span></div>
          <div class="flex justify-between"><span>gg / G</span><span>Top / Bottom</span></div>
          <div class="flex justify-between"><span>[count]G</span><span>Jump to row</span></div>
          <div class="flex justify-between"><span>Enter / d</span><span>Open comments</span></div>
          <div class="flex justify-between"><span>D</span><span>Open comments (new tab)</span></div>
          <div class="flex justify-between"><span>o</span><span>Open link</span></div>
          <div class="flex justify-between"><span>O</span><span>Open link (new tab)</span></div>
          <div class="flex justify-between"><span>zt / zz / zb</span><span>Scroll active row</span></div>

          <div class="font-bold uppercase text-tui-cyan mt-4 mb-2">Item Page</div>
          <div class="flex justify-between"><span>[count]j / [count]k</span><span>Next/Prev comment</span></div>
          <div class="flex justify-between"><span>gg / G</span><span>Top / Bottom comment</span></div>
          <div class="flex justify-between"><span>[count]G</span><span>Jump to comment</span></div>
          <div class="flex justify-between"><span>h</span><span>Jump to parent</span></div>
          <div class="flex justify-between"><span>{ / }</span><span>Prev/Next thread</span></div>
          <div class="flex justify-between"><span>H</span><span>Collapse comment</span></div>
          <div class="flex justify-between"><span>l</span><span>Expand + load + go to first child</span></div>
          <div class="flex justify-between"><span>L</span><span>Expand + load recursively + go to first child</span></div>
          <div class="flex justify-between"><span>o</span><span>Open story link</span></div>
          <div class="flex justify-between"><span>O</span><span>Open story link (new tab)</span></div>
          <div class="flex justify-between"><span>zt / zz / zb</span><span>Scroll active comment</span></div>
        </div>

        <div class="border border-tui-active/30 p-3 md:col-span-2">
          <div class="font-bold uppercase text-tui-cyan mb-2">Page Actions (current)</div>
          <div v-if="menuState.actions.length === 0" class="opacity-60 italic">NO_ACTIONS</div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
            <div v-for="a in menuState.actions" :key="a.label" class="flex justify-between gap-4" :class="a.disabled ? 'opacity-30' : ''">
              <span class="font-bold">{{ a.label.toUpperCase() }}</span>
              <span class="opacity-60">{{ a.shortcut ?? '' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="px-4 pb-4 opacity-60 font-mono text-xs">
        Tip: shortcuts are ignored while typing in inputs.
      </div>
    </div>
  </div>
</template>
