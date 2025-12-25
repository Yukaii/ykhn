<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DragGesture } from '@use-gesture/vanilla'
import { useEventListener, useMediaQuery, useWindowSize } from '@vueuse/core'

import { shouldIgnoreKeyboardEvent } from '../lib/keyboard'
import {
  setJoystickCollapsed,
  setJoystickDock,
  setJoystickPosition,
  uiState,
  type JoystickDock,
  type JoystickPosition,
} from '../store'

const isCoarsePointer = useMediaQuery('(pointer: coarse)')
const isNarrow = useMediaQuery('(max-width: 767px)')
const isDev = import.meta.env.DEV

const visible = computed(() => !uiState.shortcutsOpen && (isDev || isCoarsePointer.value || isNarrow.value))

const { width: winW, height: winH } = useWindowSize()

const BODY_PX = 56
const TAB_PX = 16
const WRAP_W_PX = BODY_PX + TAB_PX
const WRAP_H_PX = BODY_PX

const MARGIN_X = 10
const MARGIN_TOP = 10
// Space for bottom nav + safe-ish padding.
const RESERVED_BOTTOM_PX = 80

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function clampTop(top: number) {
  const maxTop = Math.max(MARGIN_TOP, winH.value - RESERVED_BOTTOM_PX - WRAP_H_PX)
  return clamp(top, MARGIN_TOP, maxTop)
}

function defaultTop() {
  return clampTop(winH.value - RESERVED_BOTTOM_PX - WRAP_H_PX)
}

function dockToLeft(dock: JoystickDock) {
  if (dock === 'left') return MARGIN_X
  return Math.max(MARGIN_X, winW.value - MARGIN_X - WRAP_W_PX)
}

const dragging = ref(false)
const dragPos = ref({ left: 0, top: 0 })

const resolvedDock = computed<JoystickDock>(() => uiState.joystickPosition?.dock ?? uiState.joystickDock)
const resolvedTop = computed(() => clampTop(uiState.joystickPosition?.top ?? defaultTop()))

watch(
  [resolvedDock, resolvedTop, winW, winH],
  () => {
    if (dragging.value) return
    dragPos.value = { left: dockToLeft(resolvedDock.value), top: resolvedTop.value }
  },
  { immediate: true }
)

const dock = computed<JoystickDock>(() => {
  if (dragging.value) {
    const mid = dragPos.value.left + WRAP_W_PX / 2
    return mid < winW.value / 2 ? 'left' : 'right'
  }
  return resolvedDock.value
})

const left = computed(() => {
  if (dragging.value) return dragPos.value.left
  return dockToLeft(dock.value)
})

const top = computed(() => {
  if (dragging.value) return dragPos.value.top
  return resolvedTop.value
})

watch(
  [winW, winH],
  () => {
    // Keep position within bounds on resize.
    if (uiState.joystickPosition) {
      const next = {
        dock: uiState.joystickPosition.dock,
        top: clampTop(uiState.joystickPosition.top),
      } satisfies JoystickPosition

      if (next.top !== uiState.joystickPosition.top) setJoystickPosition(next)
    }
  },
  { immediate: true }
)

const containerStyle = computed(() => ({
  left: `${left.value}px`,
  top: `${top.value}px`,
}))

const bodyStyle = computed(() => {
  if (!uiState.joystickCollapsed) return { transform: 'translateX(0px)' }
  const dx = dock.value === 'right' ? BODY_PX : -BODY_PX
  return { transform: `translateX(${dx}px)` }
})

const tabLabel = computed(() => {
  const collapsed = uiState.joystickCollapsed
  if (dock.value === 'left') return collapsed ? '›' : '‹'
  return collapsed ? '‹' : '›'
})

function persistDockAndTop(nextDock: JoystickDock, nextTop: number) {
  setJoystickDock(nextDock)
  setJoystickPosition({ dock: nextDock, top: clampTop(nextTop) })
}

function toggleCollapsed() {
  const next = !uiState.joystickCollapsed
  setJoystickCollapsed(next)

  // Ensure we have a persisted position so collapse is predictable.
  if (!uiState.joystickPosition) {
    persistDockAndTop(dock.value, resolvedTop.value)
  }
}

function expandFromCollapsedByArrow(e: KeyboardEvent) {
  if (!visible.value) return
  if (!uiState.joystickCollapsed) return
  if (shouldIgnoreKeyboardEvent(e)) return

  if (dock.value === 'right' && e.key === 'ArrowLeft') {
    setJoystickCollapsed(false)
    e.preventDefault()
    return
  }

  if (dock.value === 'left' && e.key === 'ArrowRight') {
    setJoystickCollapsed(false)
    e.preventDefault()
  }
}

useEventListener(window, 'keydown', expandFromCollapsedByArrow, { capture: true })

// --- key dispatch + repeat ---
let repeatTimeout: number | null = null
let repeatInterval: number | null = null

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function clearRepeat() {
  if (repeatTimeout != null) {
    window.clearTimeout(repeatTimeout)
    repeatTimeout = null
  }
  if (repeatInterval != null) {
    window.clearInterval(repeatInterval)
    repeatInterval = null
  }
}

function startRepeat(key: string) {
  dispatchKey(key)
  clearRepeat()
  repeatTimeout = window.setTimeout(() => {
    repeatInterval = window.setInterval(() => dispatchKey(key), 110)
  }, 350)
}

function stopRepeat() {
  clearRepeat()
}

// --- swipe + tap zones (pad) ---
const tabEl = ref<HTMLElement | null>(null)
const gripEl = ref<HTMLElement | null>(null)
const padEl = ref<HTMLElement | null>(null)

let tabGesture: DragGesture | null = null
let gripGesture: DragGesture | null = null
let padGesture: DragGesture | null = null

type PadZone = 'up' | 'down' | 'left' | 'right' | 'L' | 'center'

const padStartZone = ref<PadZone>('center')
const padMoved = ref(false)
let longPressTimer: number | null = null
let longPressKey: 'j' | 'k' | null = null

function clearLongPress() {
  if (longPressTimer != null) {
    window.clearTimeout(longPressTimer)
    longPressTimer = null
  }
  longPressKey = null
}

function zoneFromPoint(el: HTMLElement, x: number, y: number): PadZone {
  const r = el.getBoundingClientRect()
  const px = (x - r.left) / r.width
  const py = (y - r.top) / r.height

  // Small corner for L.
  if (px > 0.72 && py < 0.28) return 'L'

  if (py < 0.33) return 'up'
  if (py > 0.66) return 'down'
  if (px < 0.33) return 'left'
  if (px > 0.66) return 'right'
  return 'center'
}

function dispatchFromZone(zone: PadZone) {
  if (zone === 'up') dispatchKey('k')
  if (zone === 'down') dispatchKey('j')
  if (zone === 'left') dispatchKey('h')
  if (zone === 'right') dispatchKey('l')
  if (zone === 'L') dispatchKey('L')
}

function dispatchFromSwipeVector(dx: number, dy: number) {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  // Prefer diagonal up-right for L.
  if (dx > 0 && dy < 0 && absX > 18 && absY > 18) {
    dispatchKey('L')
    return
  }

  if (absX > absY) {
    dispatchKey(dx > 0 ? 'l' : 'h')
    return
  }

  dispatchKey(dy > 0 ? 'j' : 'k')
}


onMounted(() => {
  if (!tabEl.value || !gripEl.value || !padEl.value) return

  tabGesture = new DragGesture(
    tabEl.value,
    ({ last, movement: [mx], tap }) => {
      if (!last) return
      if (tap) return
      if (Math.abs(mx) < 12) return

      const towardEdge = (dock.value === 'right' && mx > 0) || (dock.value === 'left' && mx < 0)
      setJoystickCollapsed(towardEdge)
    },
    {
      filterTaps: true,
      tapsThreshold: 6,
      preventDefault: true,
      eventOptions: { passive: false, capture: true },
      pointer: { keys: false },
    }
  )

  gripGesture = new DragGesture(
    gripEl.value,
    ({ active, first, last, movement: [mx, my], memo }) => {
      if (uiState.joystickCollapsed) setJoystickCollapsed(false)

      type Memo = { startLeft: number; startTop: number }
      const resolvedMemo = (memo as Memo | undefined) ?? { startLeft: left.value, startTop: top.value }

      if (first) {
        dragging.value = true
        dragPos.value = { left: left.value, top: top.value }
        resolvedMemo.startLeft = left.value
        resolvedMemo.startTop = top.value
      }

      if (active) {
        dragPos.value.left = clamp(resolvedMemo.startLeft + mx, MARGIN_X, Math.max(MARGIN_X, winW.value - MARGIN_X - WRAP_W_PX))
        dragPos.value.top = clampTop(resolvedMemo.startTop + my)
      }

      if (last) {
        const mid = dragPos.value.left + WRAP_W_PX / 2
        const nextDock: JoystickDock = mid < winW.value / 2 ? 'left' : 'right'
        persistDockAndTop(nextDock, dragPos.value.top)
        dragging.value = false
      }

      return resolvedMemo
    },
    {
      filterTaps: true,
      preventDefault: true,
      eventOptions: { passive: false, capture: true },
      pointer: { keys: false },
    }
  )

  padGesture = new DragGesture(
    padEl.value,
    ({ first, active, last, movement: [mx, my], swipe: [sx, sy], tap, xy: [x, y] }) => {
      if (!padEl.value) return

      if (uiState.joystickCollapsed) setJoystickCollapsed(false)

      if (first) {
        stopRepeat()
        clearLongPress()
        padMoved.value = false
        padStartZone.value = zoneFromPoint(padEl.value, x, y)

        if (padStartZone.value === 'up' || padStartZone.value === 'down') {
          longPressKey = padStartZone.value === 'up' ? 'k' : 'j'
          longPressTimer = window.setTimeout(() => {
            if (!padMoved.value && longPressKey) startRepeat(longPressKey)
          }, 320)
        }
      }

      if (active && !padMoved.value && Math.hypot(mx, my) > 10) {
        padMoved.value = true
        clearLongPress()
        stopRepeat()
      }

      if (!last) return

      clearLongPress()

      // If we were repeating (long-press), just stop.
      if (repeatInterval != null || repeatTimeout != null) {
        stopRepeat()
        return
      }

      // Use @use-gesture swipe detection if available.
      if (sx || sy) {
        if (sx) dispatchKey(sx > 0 ? 'l' : 'h')
        else dispatchKey(sy > 0 ? 'j' : 'k')
        return
      }

      if (tap) {
        dispatchFromZone(padStartZone.value)
        return
      }

      if (Math.hypot(mx, my) > 18) {
        dispatchFromSwipeVector(mx, my)
        return
      }

      // Fallback: treat as tap.
      dispatchFromZone(padStartZone.value)
    },
    {
      filterTaps: true,
      tapsThreshold: 6,
      preventDefault: true,
      swipe: { distance: 18, velocity: 0.2, duration: 350 },
      eventOptions: { passive: false, capture: true },
      pointer: { keys: false },
    }
  )
})

onBeforeUnmount(() => {
  tabGesture?.destroy()
  gripGesture?.destroy()
  padGesture?.destroy()
  tabGesture = null
  gripGesture = null
  padGesture = null
  stopRepeat()
  clearLongPress()
})
</script>

<template>
  <div
    v-if="visible"
    class="ykhn-wrap md:hidden fixed z-30 select-none"
    :class="dock === 'left' ? 'ykhn-dock-left' : 'ykhn-dock-right'"
    :style="containerStyle"
  >
    <div class="ykhn-body" :style="bodyStyle">
      <button ref="gripEl" type="button" class="ykhn-grip" aria-label="Drag joystick">⠿</button>

      <div ref="padEl" class="ykhn-pad" role="group" aria-label="Thread navigation">
        <span class="ykhn-label ykhn-up" aria-hidden="true">k</span>
        <span class="ykhn-label ykhn-down" aria-hidden="true">j</span>
        <span class="ykhn-label ykhn-left" aria-hidden="true">h</span>
        <span class="ykhn-label ykhn-right" aria-hidden="true">l</span>
        <span class="ykhn-label ykhn-L" aria-hidden="true">L</span>
      </div>
    </div>

    <button
      ref="tabEl"
      type="button"
      class="ykhn-tab"
      :aria-label="uiState.joystickCollapsed ? 'Expand joystick' : 'Collapse joystick'"
      @click="toggleCollapsed"
    >
      {{ tabLabel }}
    </button>
  </div>
</template>

<style scoped>
.ykhn-wrap {
  width: 72px;
  height: 56px;
  display: flex;
  align-items: center;
}

.ykhn-dock-right {
  flex-direction: row;
}

.ykhn-dock-left {
  flex-direction: row-reverse;
}

.ykhn-tab {
  width: 16px;
  height: 36px;
  border: 2px solid var(--tui-border);
  background: var(--tui-active);
  color: var(--tui-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 900;
  line-height: 1;
  padding: 0;
  user-select: none;
  touch-action: none;
}

.ykhn-body {
  width: 56px;
  height: 56px;
  position: relative;
  border: 2px solid var(--tui-border);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.5);
  transition: transform 160ms ease;
}

.ykhn-grip {
  position: absolute;
  top: 2px;
  z-index: 2;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--tui-border);
  background: var(--tui-bg);
  color: var(--tui-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 900;
  font-size: 12px;
  line-height: 1;
  user-select: none;
  touch-action: none;
}

.ykhn-dock-right .ykhn-grip {
  left: 2px;
}

.ykhn-dock-left .ykhn-grip {
  left: 2px;
}

.ykhn-pad {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  width: 56px;
  height: 56px;
  background: var(--tui-bg);
  touch-action: none;
}

.ykhn-label {
  position: absolute;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 800;
  font-size: 11px;
  text-transform: none;
  color: var(--tui-text);
  opacity: 0.75;
  pointer-events: none;
}

.ykhn-up {
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.ykhn-down {
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.ykhn-left {
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.ykhn-right {
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.ykhn-L {
  right: 4px;
  top: 4px;
  opacity: 0.75;
}
</style>
