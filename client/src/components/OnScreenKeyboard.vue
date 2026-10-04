<template>
  <!-- data-osk-root marks everything here as keyboard, so it is never treated
       as a field and its taps are kept away from Vuetify's click-outside. -->
  <div data-osk-root>
    <Transition name="osk-slide">
      <div
        v-if="keyboard.visible && keyboard.target" ref="panel"
        class="osk"
        role="group" aria-label="On-screen keyboard"
      >
        <!-- Toolbar. It is the same width for both layouts, so the 123 | ABC
             switch on its left stays in one place whichever is showing. -->
        <div class="osk-header">
          <div v-if="keyboard.layout === 'text'" class="osk-mode" role="radiogroup" aria-label="Keyboard type">
            <button
              type="button" tabindex="-1" role="radio" class="osk-mode-btn osk-mode-pad"
              :class="{ 'osk-mode-active': showPad }" :aria-checked="showPad" title="Number pad"
              @pointerdown.prevent="press($event, () => { fullKeyboard = false })"
            >
              <v-icon size="14">mdi-dialpad</v-icon> 123
            </button>
            <button
              type="button" tabindex="-1" role="radio" class="osk-mode-btn osk-mode-abc"
              :class="{ 'osk-mode-active': !showPad }" :aria-checked="!showPad" title="Letters and numbers"
              @pointerdown.prevent="press($event, () => { fullKeyboard = true })"
            >
              <v-icon size="14">mdi-keyboard-outline</v-icon> ABC
            </button>
          </div>
          <span class="osk-header-spacer" />
          <button
            v-if="keyboard.value"
            type="button" tabindex="-1" class="osk-icon-btn" title="Clear"
            @pointerdown.prevent="press($event, clearField)"
          >
            <v-icon size="18">mdi-close-circle-outline</v-icon>
          </button>
          <button
            type="button" tabindex="-1" class="osk-auto" role="switch" :aria-checked="keyboard.autoOpen"
            title="Open the keyboard automatically when a field is tapped"
            @pointerdown.prevent="press($event, () => setAutoOpen(!keyboard.autoOpen))"
          >
            <v-icon size="18">{{ keyboard.autoOpen ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}</v-icon>
            <span>Auto-open</span>
          </button>
          <button type="button" tabindex="-1" class="osk-icon-btn" title="Hide keyboard" @pointerdown.prevent="press($event, hideKeyboard)">
            <v-icon size="18">mdi-keyboard-close-outline</v-icon>
          </button>
        </div>

        <!-- Number pad: what every field opens with. -->
        <div v-if="showPad" class="osk-pad">
          <div class="osk-pad-digits">
            <button
              v-for="key in padKeys" :key="key.id"
              type="button" tabindex="-1"
              class="osk-key osk-key-lg" :class="{ 'osk-key-blank': !key.text }"
              :disabled="!key.text"
              @pointerdown.prevent="press($event, () => insertText(key.text))"
            >{{ key.text }}</button>
          </div>
          <div class="osk-pad-actions">
            <button type="button" tabindex="-1" class="osk-key osk-key-lg osk-key-muted" title="Backspace" @pointerdown.prevent="startRepeat($event)">
              <v-icon size="18">mdi-backspace-outline</v-icon>
            </button>
            <button type="button" tabindex="-1" class="osk-key osk-key-lg osk-key-outline" @pointerdown.prevent="press($event, focusNextField)">
              Next <v-icon size="18" class="ml-1">mdi-arrow-right</v-icon>
            </button>
            <button type="button" tabindex="-1" class="osk-key osk-key-lg osk-key-done osk-key-grow" @pointerdown.prevent="press($event, finishEditing)">
              Done
            </button>
          </div>
        </div>

        <!-- Full keyboard -->
        <div v-else class="osk-board">
          <div v-for="(row, r) in textRows" :key="r" class="osk-row">
            <button
              v-for="key in row" :key="key.id"
              type="button" tabindex="-1"
              class="osk-key"
              :class="key.cls"
              :style="key.grow ? { flexGrow: key.grow } : undefined"
              :title="key.title"
              @pointerdown.prevent="onKey($event, key)"
            >
              <v-icon v-if="key.icon" size="18">{{ key.icon }}</v-icon>
              <template v-else>{{ key.label }}</template>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Brings the keyboard back for a focused field when it is hidden or
         auto-open is off. -->
    <Transition name="osk-fade">
      <button
        v-if="keyboard.target && !keyboard.visible"
        type="button" tabindex="-1" class="osk-fab" title="Show keyboard"
        @pointerdown.prevent="press($event, showKeyboard)"
      >
        <v-icon size="26">mdi-keyboard-outline</v-icon>
      </button>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  backspace, clearField, finishEditing, focusNextField, hideKeyboard, insertText,
  installKeyboardTracking, keyboard, moveCaret, setAutoOpen, showKeyboard,
} from '@/composables/useOnScreenKeyboard'

type Key = {
  id: string
  label?: string
  icon?: string
  title?: string
  grow?: number
  cls?: string[]
  action: () => void
}

const panel = ref<HTMLElement | null>(null)

// Every field opens on the number pad. A text field can switch to the full
// keyboard and back with the 123 | ABC switch; number and phone fields only
// take digits, so they stay on the pad.
const fullKeyboard = ref(false)
const showPad = computed(() => keyboard.layout !== 'text' || !fullKeyboard.value)

// --- key layouts -------------------------------------------------------------

const shift = ref(false)
const capsLock = ref(false)
const symbols = ref(false)
let lastShiftAt = 0

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const SYMBOLS = [
  ['!', '@', '#', '$', '%', '&', '*', '(', ')', '/'],
  ['-', '_', '+', '=', ':', ';', "'", '"', '?'],
  ['~', '<', '>', '[', ']', '{', '}', '\\'],
]

const upper = computed(() => shift.value || capsLock.value)

function charKey(ch: string): Key {
  return {
    id: `c-${ch}`,
    label: ch,
    action: () => {
      insertText(ch)
      // One-shot shift applies to a single letter; caps lock stays.
      if (shift.value && !capsLock.value) shift.value = false
    },
  }
}

function toggleShift() {
  const now = performance.now()
  if (capsLock.value) {
    capsLock.value = false
    shift.value = false
  } else if (shift.value && now - lastShiftAt < 400) {
    capsLock.value = true // double tap
  } else {
    shift.value = !shift.value
  }
  lastShiftAt = now
}

const backspaceKey: Key = { id: 'bksp', icon: 'mdi-backspace-outline', title: 'Backspace', grow: 1.5, cls: ['osk-key-muted'], action: backspace }
const nextKey: Key = { id: 'next', label: 'Next', title: 'Next field', grow: 1.6, cls: ['osk-key-outline'], action: focusNextField }
// In a multi-line field the same slot starts a new line instead.
const enterKey: Key = { id: 'enter', icon: 'mdi-keyboard-return', title: 'New line', grow: 1.6, cls: ['osk-key-muted'], action: () => insertText('\n') }
const rowEndKey = computed(() => (keyboard.multiline ? enterKey : nextKey))

const textRows = computed<Key[][]>(() => {
  const numberRow = [...'1234567890'].map(charKey).concat(backspaceKey)

  if (symbols.value) {
    return [
      numberRow,
      SYMBOLS[0].map(charKey),
      [...SYMBOLS[1].map(charKey), rowEndKey.value],
      [...SYMBOLS[2].map(charKey), charKey(','), charKey('.')],
      bottomRow('ABC', 'Letters'),
    ]
  }

  const letters = LETTERS.map((row) => [...row].map((ch) => charKey(upper.value ? ch.toUpperCase() : ch)))
  const shiftKey: Key = {
    id: 'shift',
    icon: capsLock.value ? 'mdi-apple-keyboard-caps' : 'mdi-apple-keyboard-shift',
    title: 'Shift (double-tap for caps lock)',
    grow: 1.5,
    cls: ['osk-key-muted', ...(upper.value ? ['osk-key-active'] : [])],
    action: toggleShift,
  }
  return [
    numberRow,
    letters[0],
    [...letters[1], rowEndKey.value],
    [shiftKey, ...letters[2], charKey(','), charKey('.'), charKey('-')],
    bottomRow('?123', 'Symbols'),
  ]
})

function bottomRow(toggleLabel: string, toggleTitle: string): Key[] {
  const row: Key[] = [
    { id: 'layer', label: toggleLabel, title: toggleTitle, grow: 1.5, cls: ['osk-key-muted'], action: () => { symbols.value = !symbols.value } },
    charKey('@'),
    { id: 'space', label: 'space', title: 'Space', grow: 6, cls: ['osk-key-space'], action: () => insertText(' ') },
  ]
  if (keyboard.canMoveCaret) {
    row.push(
      { id: 'left', icon: 'mdi-chevron-left', title: 'Move cursor left', cls: ['osk-key-muted'], action: () => moveCaret(-1) },
      { id: 'right', icon: 'mdi-chevron-right', title: 'Move cursor right', cls: ['osk-key-muted'], action: () => moveCaret(1) },
    )
  }
  row.push({ id: 'done', label: 'Done', grow: 2, cls: ['osk-key-done'], action: finishEditing })
  return row
}

const padKeys = computed(() => {
  // A text field shown on the pad may still want a '.' (e.g. an address).
  const bottomLeft = keyboard.layout === 'tel' ? '+' : keyboard.allowDecimal || keyboard.layout === 'text' ? '.' : ''
  const bottomRight = keyboard.layout === 'tel' ? '' : '00'
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft, '0', bottomRight]
    .map((text, i) => ({ id: `p-${i}`, text }))
})

// Each field starts on the number pad; on the full keyboard, on letters, lower case.
watch(() => keyboard.target, () => {
  fullKeyboard.value = false
  shift.value = false
  capsLock.value = false
  symbols.value = false
})

// --- pressing ----------------------------------------------------------------

// Keys act on pointerdown (instant feedback, and the default is prevented so
// focus never leaves the field — otherwise a dialog's focus trap would pull it
// back, blur validation would fire and an autocomplete would close).
function press(e: PointerEvent, action: () => void) {
  if (e.button > 0) return
  flash(e.currentTarget)
  action()
}

function onKey(e: PointerEvent, key: Key) {
  if (key.id === 'bksp') startRepeat(e)
  else press(e, key.action)
}

function flash(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return
  el.classList.remove('osk-pressed')
  void el.offsetWidth // restart the animation on rapid taps
  el.classList.add('osk-pressed')
}

// Backspace repeats while held.
let repeatDelay: ReturnType<typeof setTimeout> | undefined
let repeatTimer: ReturnType<typeof setInterval> | undefined

function stopRepeat() {
  clearTimeout(repeatDelay)
  clearInterval(repeatTimer)
  window.removeEventListener('pointerup', stopRepeat)
  window.removeEventListener('pointercancel', stopRepeat)
}

function startRepeat(e: PointerEvent) {
  if (e.button > 0) return
  stopRepeat()
  flash(e.currentTarget)
  backspace()
  repeatDelay = setTimeout(() => { repeatTimer = setInterval(backspace, 60) }, 450)
  window.addEventListener('pointerup', stopRepeat)
  window.addEventListener('pointercancel', stopRepeat)
}

// --- keeping the field in view ------------------------------------------------

// The keyboard's height is published as --osk-h so the page and any open
// dialog can make room for it (see the global styles below).
let resizeObserver: ResizeObserver | undefined

function setKeyboardHeight(px: number) {
  const root = document.documentElement
  if (root.style.getPropertyValue('--osk-h') === `${px}px`) return
  root.style.setProperty('--osk-h', `${px}px`)
  root.classList.toggle('osk-open', px > 0)
  // Lifting or lowering a dialog moves the field an open dropdown (e.g. the
  // customer search results) is attached to, but Vuetify only repositions
  // menus on a window resize or scroll — so announce one once the dialog has
  // moved, then fit the menus above the keyboard.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
    requestAnimationFrame(fitMenus)
  })
}

// --- dropdowns ------------------------------------------------------------------

// Vuetify sizes a menu against the whole window and cannot know the keyboard
// covers the bottom of it, so a results list would run on underneath. While
// the keyboard is open, cap each open menu so it ends above the keyboard; its
// list scrolls instead. The cap goes in a data attribute + custom property,
// which Vuetify's own style and class bindings leave alone, and it is never
// more than the max-height Vuetify chose itself.
const MENU_CONTENT = '.v-overlay--active.v-menu > .v-overlay__content'
const MENU_GAP = 8
const MIN_MENU_HEIGHT = 56 // about one row: below this, leave Vuetify's placement
let menuObserver: MutationObserver | undefined
let fitQueued = false

function uncapMenus() {
  document.querySelectorAll<HTMLElement>('[data-osk-capped]').forEach((el) => {
    delete el.dataset.oskCapped
    el.style.removeProperty('--osk-menu-max')
  })
}

function fitMenus() {
  fitQueued = false
  if (!panel.value) return uncapMenus()
  const keyboardTop = panel.value.getBoundingClientRect().top
  for (const el of document.querySelectorAll<HTMLElement>(MENU_CONTENT)) {
    const box = el.getBoundingClientRect()
    const room = Math.floor(keyboardTop - box.top - MENU_GAP)
    const own = parseFloat(el.style.maxHeight) || Infinity
    const capped = el.dataset.oskCapped !== undefined
    // Cap only a menu that reaches the keyboard (or is capped already and
    // still would). One that fits, or that opens upwards / starts too close
    // to the keyboard to be useful capped, keeps Vuetify's own placement.
    const wouldOverlap = capped ? room < own : box.bottom > keyboardTop - MENU_GAP
    if (wouldOverlap && room >= MIN_MENU_HEIGHT) {
      const cap = `${Math.min(room, own)}px`
      if (el.style.getPropertyValue('--osk-menu-max') !== cap) el.style.setProperty('--osk-menu-max', cap)
      if (!capped) el.dataset.oskCapped = ''
    } else if (capped) {
      delete el.dataset.oskCapped
      el.style.removeProperty('--osk-menu-max')
    }
  }
}

function queueFitMenus() {
  if (fitQueued) return
  fitQueued = true
  requestAnimationFrame(fitMenus)
}

// Menus open, filter (resize) and get repositioned by Vuetify while the
// keyboard is up; re-fit after each of those.
function watchMenus(active: boolean) {
  menuObserver?.disconnect()
  menuObserver = undefined
  if (!active) return uncapMenus()
  menuObserver = new MutationObserver(queueFitMenus)
  menuObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] })
}

function scrollableParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

// scrollIntoView alone does not know the keyboard covers the bottom of the
// viewport, so finish by scrolling the field clear of it.
function revealTarget() {
  const el = keyboard.target
  if (!el || !keyboard.visible) return
  el.scrollIntoView({ block: 'nearest' })
  const keyboardTop = window.innerHeight - (panel.value?.offsetHeight ?? 0)
  const overlap = el.getBoundingClientRect().bottom + 16 - keyboardTop
  if (overlap <= 0) return
  const parent = scrollableParent(el)
  if (parent) parent.scrollBy({ top: overlap })
  else window.scrollBy({ top: overlap })
}

watch(panel, (el) => {
  resizeObserver?.disconnect()
  watchMenus(!!el)
  if (!el) {
    setKeyboardHeight(0)
    return
  }
  resizeObserver = new ResizeObserver(() => {
    setKeyboardHeight(el.offsetHeight)
    requestAnimationFrame(revealTarget)
  })
  resizeObserver.observe(el)
})

watch(() => [keyboard.target, keyboard.visible], async () => {
  await nextTick()
  requestAnimationFrame(revealTarget)
})

// --- lifecycle ----------------------------------------------------------------

// Vuetify closes menus (e.g. the customer search results) on any mousedown/
// click outside them, listening in the capture phase on the document. A
// capture listener on window runs first, so taps on the keyboard are stopped
// there and never count as "outside". Keys act on pointerdown, so nothing
// here needs the click itself.
function shieldKeyboardClicks(e: Event) {
  if (e.target instanceof Element && e.target.closest('[data-osk-root]')) {
    e.stopImmediatePropagation()
    e.preventDefault()
  }
}

let uninstall: (() => void) | undefined

onMounted(() => {
  uninstall = installKeyboardTracking()
  window.addEventListener('mousedown', shieldKeyboardClicks, true)
  window.addEventListener('click', shieldKeyboardClicks, true)
})

onBeforeUnmount(() => {
  uninstall?.()
  stopRepeat()
  resizeObserver?.disconnect()
  watchMenus(false)
  setKeyboardHeight(0)
  window.removeEventListener('mousedown', shieldKeyboardClicks, true)
  window.removeEventListener('click', shieldKeyboardClicks, true)
})
</script>

<style scoped lang="scss">
$teal: #0f766e;
$teal-dark: #0d3d38;
// Both layouts share one key-area height (the full keyboard's five 34px rows
// and their gaps), so the toolbar above them — and the 123 | ABC switch in
// it — does not move when switching.
$keys-height: 5 * 34px + 4 * 4px;

.osk {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  // Above Vuetify dialogs and menus, below the toast (9999).
  z-index: 5000;
  background: #e8eeec;
  border-top: 1px solid #cbd5d2;
  box-shadow: 0 -6px 24px rgba(13, 61, 56, 0.18);
  padding: 0 8px 6px;
  user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.osk-header {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 760px;
  min-height: 34px;
  margin: 0 auto;
  padding: 3px 2px;
}

.osk-header-spacer { flex: 1; }

// 123 | ABC: a segmented switch, the active side filled.
.osk-mode {
  display: inline-flex;
  padding: 3px;
  gap: 3px;
  border-radius: 10px;
  background: #d5dfdc;
}

.osk-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: $teal-dark;
  cursor: pointer;

  .v-icon { color: inherit; }
}

.osk-mode-active {
  background: $teal;
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.osk-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  color: $teal-dark;
  background: transparent;
  cursor: pointer;

  @media (hover: hover) { &:hover { background: rgba(15, 118, 110, 0.08); } }
}

.osk-auto {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;

  padding: 4px 6px;
  border-radius: 7px;

  .v-icon { color: $teal; }
  @media (hover: hover) { &:hover { background: rgba(15, 118, 110, 0.08); } }
}

// --- keys ---

.osk-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
  height: 34px;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  font-size: 15px;
  font-weight: 500;
  box-shadow: 0 1px 0 #b8c4c1, 0 1px 2px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: background 0.12s ease;

  &.osk-pressed { animation: osk-press 0.18s ease; }
  @media (hover: hover) { &:hover { background: #f8faf9; } }
}

@keyframes osk-press {
  0% { background: #ccfbf1; transform: scale(0.96); }
  100% { background: #fff; transform: scale(1); }
}

.osk-key-muted { background: #d5dfdc; color: $teal-dark; font-size: 13px; font-weight: 600; @media (hover: hover) { &:hover { background: #cad6d3; } } }
.osk-key-active { background: $teal; color: #fff; @media (hover: hover) { &:hover { background: $teal; } } }
.osk-key-space { font-size: 12px; color: #6b7280; }
.osk-key-outline { background: #fff; color: $teal; border: 2px solid $teal; font-size: 13px; font-weight: 600; }
.osk-key-done { background: $teal; color: #fff; font-size: 14px; font-weight: 700; @media (hover: hover) { &:hover { background: #0e6b64; } } }
.osk-key-lg { height: 40px; font-size: 17px; }
.osk-key-blank { visibility: hidden; }
.osk-key-grow { flex-grow: 1; height: auto; }

.osk-board {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: $keys-height;
  max-width: 760px;
  margin: 0 auto;
}

.osk-row {
  flex: 1;
  display: flex;
  gap: 4px;

  .osk-key { height: auto; }
}

// Four rows filling the same height; the action column shares the rows, with
// Done spanning the bottom two.
.osk-pad {
  display: flex;
  gap: 6px;
  height: $keys-height;
  max-width: 320px;
  margin: 0 auto;

  .osk-key { height: auto; }
}

.osk-pad-digits {
  flex: 3;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;
}

.osk-pad-actions {
  flex: 1.3;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;

  .osk-key-grow { grid-row: span 2; }
  .osk-key-outline { font-size: 13px; }
}

.osk-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 5000;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $teal;
  color: #fff;
  box-shadow: 0 6px 18px rgba(13, 61, 56, 0.35);
  cursor: pointer;
  touch-action: manipulation;

  @media (hover: hover) { &:hover { background: #0e6b64; } }
}

// --- transitions ---

.osk-slide-enter-active, .osk-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.osk-slide-enter-from, .osk-slide-leave-to { transform: translateY(100%); opacity: 0.6; }
.osk-fade-enter-active, .osk-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.osk-fade-enter-from, .osk-fade-leave-to { opacity: 0; transform: scale(0.8); }
</style>

<style lang="scss">
// Make room for the keyboard while it is open: extra scroll space at the
// bottom of the page, and dialogs moved into the space above it.
html.osk-open body {
  padding-bottom: var(--osk-h, 0px);
}

// Dropdown lists capped to end above the keyboard (see fitMenus).
html.osk-open .v-overlay__content[data-osk-capped] {
  max-height: var(--osk-menu-max) !important;
}

// The padding confines the dialog to the area above the keyboard, and it sits
// at the top of that area rather than its centre, as with a phone keyboard:
// fields sit higher, leaving room for dropdown lists below them. Its content
// is absolutely positioned, so Vuetify's own max-height (calc(100% - 48px))
// is measured against the whole screen and would not shrink it — cap it
// explicitly, and the dialog scrolls inside instead.
html.osk-open .v-overlay.v-dialog {
  padding-bottom: var(--osk-h, 0px);
  align-items: flex-start;

  > .v-overlay__content {
    max-height: calc(100% - var(--osk-h, 0px) - 48px);
  }
}
</style>
