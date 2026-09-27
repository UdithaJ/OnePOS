import { reactive } from 'vue'

// On-screen keyboard state and editing, shared by the single <OnScreenKeyboard>
// mounted in App.vue. It attaches to whichever text field has focus, so no
// form needs to opt in.
//
// Typing goes through document.execCommand('insertText' / 'delete'), which
// edits the field exactly as a physical key would: it fires native `input`
// events (so v-model and @input handlers run), respects maxlength, and works on
// type="number" fields. Assigning `el.value` does not — a number field discards
// an in-progress value such as "12." and the decimal point is lost.

export type KeyboardLayout = 'text' | 'numeric' | 'tel'
type Field = HTMLInputElement | HTMLTextAreaElement

const TEXT_TYPES = new Set(['text', 'search', 'tel', 'number', 'password', 'email', 'url'])
const AUTO_OPEN_KEY = 'onepos.osk.autoOpen'
// A focus that follows a tap within this window counts as "tapped into".
const TAP_FOCUS_WINDOW_MS = 800

function loadAutoOpen(): boolean {
  try {
    return localStorage.getItem(AUTO_OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

export const keyboard = reactive({
  target: null as Field | null,
  visible: false,
  layout: 'text' as KeyboardLayout,
  allowDecimal: false,
  // Kept current so the Clear key only shows when there is something to clear.
  value: '',
  canMoveCaret: false,
  multiline: false,
  autoOpen: loadAutoOpen(),
})

// The original inputmode, before it is set to "none" while the keyboard is
// shown (see suppressSystemKeyboard).
function inputModeOf(el: Field): string {
  return el.dataset.oskInputmode ?? el.getAttribute('inputmode') ?? ''
}

export function isKeyboardField(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  if (el.readOnly || el.disabled || el.closest('[data-osk-root], [data-osk-ignore]')) return false
  // A field that asks for no virtual keyboard gets none — notably every
  // v-select, whose input is not readonly but carries inputmode="none".
  if (inputModeOf(el) === 'none') return false
  // Date fields keep their own picker.
  return el instanceof HTMLTextAreaElement || TEXT_TYPES.has(el.type)
}

// --- layout -------------------------------------------------------------------

function layoutFor(el: Field): { layout: KeyboardLayout; allowDecimal: boolean } {
  const mode = inputModeOf(el)
  const type = el instanceof HTMLInputElement ? el.type : 'textarea'
  if (type === 'tel' || mode === 'tel') return { layout: 'tel', allowDecimal: false }
  if (type === 'number' || mode === 'decimal') return { layout: 'numeric', allowDecimal: true }
  if (mode === 'numeric') return { layout: 'numeric', allowDecimal: false }
  return { layout: 'text', allowDecimal: false }
}

function refreshValue() {
  keyboard.value = keyboard.target?.value ?? ''
}

// --- the system (Windows) touch keyboard ------------------------------------

// On touch hardware Chromium may raise the OS keyboard as well; inputmode=none
// suppresses it while ours is showing. The original value is kept so layout
// choice and restoration both see it.
function suppressSystemKeyboard(el: Field) {
  if (el.dataset.oskInputmode === undefined) {
    el.dataset.oskInputmode = el.getAttribute('inputmode') ?? ''
  }
  el.setAttribute('inputmode', 'none')
}

function restoreSystemKeyboard(el: Field | null) {
  if (!el || el.dataset.oskInputmode === undefined) return
  const original = el.dataset.oskInputmode
  if (original) el.setAttribute('inputmode', original)
  else el.removeAttribute('inputmode')
  delete el.dataset.oskInputmode
}

// --- attach / show / hide ---------------------------------------------------

function attach(el: Field) {
  if (keyboard.target !== el) {
    keyboard.target?.removeEventListener('input', refreshValue)
    restoreSystemKeyboard(keyboard.target)
    el.addEventListener('input', refreshValue)
  }
  keyboard.target = el
  Object.assign(keyboard, layoutFor(el))
  // Number fields have no caret API (selectionStart is null).
  keyboard.canMoveCaret = el.selectionStart !== null
  keyboard.multiline = el instanceof HTMLTextAreaElement
  refreshValue()
  if (keyboard.visible) suppressSystemKeyboard(el)
}

function detach() {
  keyboard.target?.removeEventListener('input', refreshValue)
  restoreSystemKeyboard(keyboard.target)
  keyboard.target = null
  keyboard.visible = false
}

export function showKeyboard() {
  if (!keyboard.target) return
  suppressSystemKeyboard(keyboard.target)
  keyboard.visible = true
}

export function hideKeyboard() {
  keyboard.visible = false
  restoreSystemKeyboard(keyboard.target)
}

// "Done": close the keyboard and leave the field, so blur validation runs.
export function finishEditing() {
  const el = keyboard.target
  detach()
  el?.blur()
}

export function setAutoOpen(value: boolean) {
  keyboard.autoOpen = value
  try {
    localStorage.setItem(AUTO_OPEN_KEY, String(value))
  } catch {
    // per-device convenience only
  }
}

// --- editing ----------------------------------------------------------------

function focusTarget(): Field | null {
  const el = keyboard.target
  if (el && document.activeElement !== el) el.focus()
  return el
}

// Fallback for the (unexpected) case where execCommand is unavailable.
function setValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function insertText(text: string) {
  const el = focusTarget()
  if (!el) return
  if (!document.execCommand('insertText', false, text)) setValue(el, el.value + text)
}

export function backspace() {
  const el = focusTarget()
  if (!el) return
  if (!document.execCommand('delete')) setValue(el, el.value.slice(0, -1))
}

export function clearField() {
  const el = focusTarget()
  if (!el || !el.value) return
  el.select()
  if (!document.execCommand('delete')) setValue(el, '')
}

export function moveCaret(delta: number) {
  const el = focusTarget()
  if (!el || el.selectionStart === null) return
  const pos = Math.min(Math.max((delta < 0 ? el.selectionStart : el.selectionEnd ?? 0) + delta, 0), el.value.length)
  el.setSelectionRange(pos, pos)
}

function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null || el.getClientRects().length > 0
}

// "Next": the next text field in the same dialog (or page). Crossing out of a
// dialog would only have its focus trap pull focus straight back.
export function focusNextField() {
  const el = keyboard.target
  if (!el) return
  const scope: ParentNode = el.closest('.v-overlay__content') ?? document
  const fields = Array.from(scope.querySelectorAll<HTMLElement>('input, textarea'))
    .filter((f): f is Field => isKeyboardField(f) && isVisible(f))
  const next = fields[fields.indexOf(el) + 1]
  if (next) next.focus()
  else finishEditing()
}

// --- focus tracking ---------------------------------------------------------

let lastTapAt = 0
let pointerIsDown = false
let detachAfterTap = false
let installed = false

function detachUnlessEditing() {
  detachAfterTap = false
  if (!isKeyboardField(document.activeElement)) detach()
}

export function installKeyboardTracking(): () => void {
  if (installed) return () => {}
  installed = true

  // Only a tap opens the keyboard. Dialogs move focus into themselves when
  // they open and some fields autofocus; opening on those would pop the
  // keyboard up uninvited. Pointer type is deliberately not checked: many
  // resistive POS screens report touches as a mouse.
  const onPointerDown = (e: PointerEvent) => {
    pointerIsDown = true
    if (!(e.target instanceof Element) || e.target.closest('[data-osk-root]')) return
    lastTapAt = performance.now()
  }

  // The click that ends a tap lands wherever is under the finger at release.
  const onPointerUp = () => {
    pointerIsDown = false
    // After the click has been dispatched (it follows pointerup in the same task).
    if (detachAfterTap) setTimeout(detachUnlessEditing, 0)
  }

  const onFocusIn = (e: FocusEvent) => {
    if (!isKeyboardField(e.target)) return
    const tapped = performance.now() - lastTapAt < TAP_FOCUS_WINDOW_MS
    attach(e.target)
    if (!keyboard.visible && tapped && keyboard.autoOpen) showKeyboard()
  }

  // Keys never take focus, so focus leaving the field means the user moved on.
  // Wait a tick: during Next, or a tap on another field, focus is briefly on
  // <body> before landing on the new field.
  //
  // If the focus left because a button was pressed, wait for that tap to end
  // too. Closing the keyboard on press would drop the dialog it had lifted
  // while the finger is still down, and the click would miss the button.
  const onFocusOut = () => {
    setTimeout(() => {
      if (pointerIsDown) detachAfterTap = true
      else detachUnlessEditing()
    }, 0)
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerUp, true)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointerup', onPointerUp, true)
    document.removeEventListener('pointercancel', onPointerUp, true)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    detach()
    installed = false
  }
}
