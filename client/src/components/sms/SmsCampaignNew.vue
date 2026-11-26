<template>
  <div class="sms-page p-6">
    <div class="flex items-center gap-3 mb-4" style="flex: none;">
      <v-btn icon="mdi-arrow-left" variant="text" size="small" @click="router.push('/bulk-sms')" />
      <h2 class="text-2xl font-semibold text-gray-900">New SMS Campaign</h2>
    </div>

    <!-- Step indicator -->
    <div class="flex items-center gap-2 mb-4" style="flex: none;">
      <template v-for="(label, i) in STEPS" :key="label">
        <button
          type="button"
          class="step-pill"
          :class="{ 'step-pill--active': step === i + 1, 'step-pill--done': step > i + 1 }"
          :disabled="i + 1 > maxReachableStep"
          @click="step = i + 1"
        >
          <span class="step-pill__num">{{ step > i + 1 ? '✓' : i + 1 }}</span>
          {{ label }}
        </button>
        <span v-if="i < STEPS.length - 1" class="text-gray-300">—</span>
      </template>
    </div>

    <v-card class="rounded-xl overflow-hidden pos-dialog" style="border: 1px solid #e5e7eb; flex: 1 1 auto; min-height: 0;">
      <!-- Step 1: Recipients -->
      <div v-if="step === 1" class="pos-dialog__body px-6 py-5 flex flex-col">
        <v-text-field
          v-model="name"
          label="Campaign name"
          placeholder="e.g. New Year 2027"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          style="flex: none; max-width: 420px;"
          hide-details="auto"
        />

        <div class="flex flex-wrap items-center gap-3 my-3" style="flex: none;">
          <v-text-field
            v-model="search"
            placeholder="Search name, mobile or city…"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 280px;"
          />
          <v-select
            v-model="city"
            :items="cities"
            label="City"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 200px;"
          />
          <v-btn variant="tonal" style="text-transform: none;" @click="selectAllShown">
            Select all {{ filteredCustomers.length.toLocaleString() }} shown
          </v-btn>
          <v-btn variant="text" style="text-transform: none;" :disabled="!selected.length" @click="selected = []">
            Clear selection
          </v-btn>
        </div>

        <v-data-table
          v-model="selected"
          :items="filteredCustomers"
          :headers="customerHeaders"
          :loading="loadingCustomers"
          item-value="_id"
          show-select
          fixed-header
          density="compact"
          :items-per-page="50"
          :items-per-page-options="[25, 50, 100]"
          class="rounded-lg"
          style="border: 1px solid #e5e7eb; flex: 1 1 auto; min-height: 200px;"
        />
      </div>

      <!-- Step 2: Message -->
      <div v-else-if="step === 2" class="pos-dialog__body px-6 py-5">
        <div class="flex gap-6 flex-wrap">
          <div style="flex: 1 1 420px; min-width: 0;">
            <v-textarea
              ref="messageField"
              v-model="message"
              label="Message"
              placeholder="Dear {name}, wishing you a Happy New Year from Softwash Laundry!"
              rows="6"
              no-resize
              variant="outlined"
              :error-messages="templateTooLong ? [`Message must be ${maxLength} characters or fewer.`] : []"
              hide-details="auto"
            />
            <div class="flex items-center gap-2 mt-2 mb-3">
              <span class="text-sm text-gray-600">Insert:</span>
              <v-chip size="small" variant="outlined" @click="insertName">{name}</v-chip>
              <span class="text-xs text-gray-500">replaced with the customer's title and first name, e.g. "Mr Nimal"</span>
            </div>
            <div class="text-sm" :class="templateTooLong ? 'text-red-600' : 'text-gray-600'">
              {{ templateInfo.encoding }} · {{ previewChars }} / {{ maxLength }} characters ·
              {{ templateInfo.parts }} SMS part{{ templateInfo.parts === 1 ? '' : 's' }}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              One SMS holds {{ templateInfo.singleMax }} characters for {{ templateInfo.encoding }}.
              Longer messages are split into parts of {{ templateInfo.encoding === 'GSM-7' ? 153 : 67 }}, each charged as one SMS.
              Sinhala, Tamil and emoji use Unicode.
            </div>
            <v-alert v-if="stats.tooLong" type="warning" variant="tonal" density="compact" class="mt-3">
              With names filled in, the message is over {{ maxLength }} characters for {{ stats.tooLong }} customer(s). They will be skipped.
            </v-alert>
          </div>

          <div style="flex: 1 1 300px; min-width: 0;">
            <div class="text-sm font-medium text-gray-700 mb-2">Preview<span v-if="previewCustomer"> ({{ fullName(previewCustomer) }})</span></div>
            <div class="sms-bubble">{{ previewText || 'Your message will appear here.' }}</div>
          </div>
        </div>
      </div>

      <!-- Step 3: Review -->
      <div v-else class="pos-dialog__body px-6 py-5">
        <div class="flex gap-6 flex-wrap">
          <div style="flex: 1 1 360px; min-width: 0;">
            <table class="review-table">
              <tbody>
                <tr><th>Campaign</th><td>{{ name }}</td></tr>
                <tr><th>Recipients</th><td><strong>{{ stats.sendable.toLocaleString() }}</strong></td></tr>
                <tr v-if="stats.skipped">
                  <th>Skipped</th>
                  <td>
                    {{ stats.skipped }}
                    <span class="text-xs text-gray-500">
                      ({{ [stats.invalid && `${stats.invalid} invalid number`, stats.duplicates && `${stats.duplicates} duplicate number`, stats.tooLong && `${stats.tooLong} too long`].filter(Boolean).join(', ') }})
                    </span>
                  </td>
                </tr>
                <tr><th>SMS parts each</th><td>{{ stats.maxParts === stats.minParts ? stats.maxParts : `${stats.minParts}–${stats.maxParts}` }} ({{ templateInfo.encoding }})</td></tr>
                <tr><th>Estimated credits</th><td>≈ {{ stats.credits.toLocaleString() }}</td></tr>
                <tr><th>Sender ID</th><td>{{ config?.senderId || '—' }}</td></tr>
                <tr><th>Estimated time</th><td>{{ formatDuration(estimatedSeconds) || 'under a minute' }}</td></tr>
              </tbody>
            </table>

            <div class="text-sm font-medium text-gray-700 mt-4 mb-2">Message</div>
            <div class="sms-bubble">{{ previewText }}</div>
          </div>

          <div style="flex: 1 1 300px; min-width: 0;">
            <div class="text-sm font-medium text-gray-700 mb-2">Send a test first</div>
            <p class="text-xs text-gray-500 mb-2">Sends this message to one number ({name} becomes "Customer") so you can check it on a real phone.</p>
            <div class="flex gap-2 items-start">
              <v-text-field
                v-model="testNumber"
                placeholder="07X XXX XXXX"
                density="compact"
                variant="outlined"
                hide-details="auto"
                :error-messages="testNumber && !toNotifyNumber(testNumber) ? ['Enter a Sri Lankan mobile number'] : []"
              />
              <v-btn
                variant="outlined"
                :loading="testing"
                :disabled="!toNotifyNumber(testNumber)"
                style="text-transform: none;"
                @click="sendTest"
              >Send test</v-btn>
            </div>

            <v-alert v-if="config && !config.configured" type="error" variant="tonal" density="compact" class="mt-4">
              Notify.lk credentials are not configured. The campaign will pause straight away.
            </v-alert>
            <v-alert type="info" variant="tonal" density="compact" class="mt-4">
              Sending runs in the background while OnePOS is open. Closing the app pauses it; it carries on when the app starts again.
            </v-alert>
          </div>
        </div>
      </div>

      <div class="pos-dialog__actions" style="justify-content: space-between;">
        <span class="text-sm text-gray-600">
          {{ selected.length.toLocaleString() }} selected
          <template v-if="stats.skipped"> · {{ stats.sendable.toLocaleString() }} will be sent, {{ stats.skipped }} skipped</template>
        </span>
        <div class="flex gap-3">
          <v-btn v-if="step > 1" variant="outlined" style="text-transform: none;" @click="step -= 1">Back</v-btn>
          <v-btn
            v-if="step < 3"
            :disabled="!canContinue"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="step += 1"
          >Next</v-btn>
          <v-btn
            v-else
            :disabled="!canContinue"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="confirmDialog = true"
          >Start sending</v-btn>
        </div>
      </div>
    </v-card>

    <v-dialog v-model="confirmDialog" max-width="440">
      <v-card class="rounded-xl overflow-hidden pos-dialog">
        <div class="pos-dialog__header bg-[#0d3d38] text-white px-6 py-4">
          <span class="text-base font-semibold">Start sending?</span>
        </div>
        <div class="pos-dialog__body px-6 py-5 text-sm text-gray-700">
          Send <strong>{{ name }}</strong> to <strong>{{ stats.sendable.toLocaleString() }} customer(s)</strong>,
          using about {{ stats.credits.toLocaleString() }} SMS credits? Once sent, an SMS cannot be taken back.
        </div>
        <div class="pos-dialog__actions">
          <v-btn variant="outlined" style="text-transform: none;" @click="confirmDialog = false">Cancel</v-btn>
          <v-btn
            :loading="creating"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="start"
          >Send now</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { getAllCustomers } from '@/services/customerApiService'
import { createCampaign, getSmsConfig, sendTestSms, type SmsConfig } from '@/services/smsApiService'
import { smsInfo, measureText, infoFromMeasure } from '@/utils/smsEncoding'
import { toNotifyNumber, renderMessage, greetingName, formatDuration } from './smsStatus'

interface CustomerRow {
  _id: string
  title?: string
  firstName?: string
  lastName?: string
  mobileNumber?: string
  city?: string
  fullName: string
}

const STEPS = ['Recipients', 'Message', 'Review & send']

const router = useRouter()
const { showToast } = useToast()
const { getUser } = useAuth()

const step = ref(1)
const config = ref<SmsConfig | null>(null)
const maxLength = computed(() => config.value?.maxLength ?? 621)

// --- Step 1: recipients ------------------------------------------------------
const name = ref('')
const customers = ref<CustomerRow[]>([])
const loadingCustomers = ref(false)
const selected = ref<string[]>([])
const search = ref('')
const city = ref<string | null>(null)

const customerHeaders = [
  { title: 'Name', key: 'fullName', sortable: true },
  { title: 'Mobile', key: 'mobileNumber', sortable: false },
  { title: 'City', key: 'city', sortable: true },
]

function fullName(c: { firstName?: string; lastName?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ')
}

const cities = computed(() =>
  [...new Set(customers.value.map(c => (c.city || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
)

const filteredCustomers = computed(() => {
  const q = (search.value || '').trim().toLowerCase()
  return customers.value.filter(c => {
    if (city.value && (c.city || '').trim() !== city.value) return false
    if (!q) return true
    return c.fullName.toLowerCase().includes(q)
      || (c.mobileNumber || '').includes(q)
      || (c.city || '').toLowerCase().includes(q)
  })
})

// Adds every customer matching the current search/city, not just the visible page.
function selectAllShown() {
  const set = new Set(selected.value)
  for (const c of filteredCustomers.value) set.add(c._id)
  selected.value = [...set]
}

// --- Step 2: message ---------------------------------------------------------
const message = ref('')
const messageField = ref<any>(null)

// The message as the preview customer gets it: what the counter describes.
const templateInfo = computed(() => smsInfo(previewText.value || message.value))
const previewChars = computed(() => measureText(previewText.value || message.value).codePoints)
// The server limits the template itself to maxLength code points.
const templateTooLong = computed(() => measureText(message.value).codePoints > maxLength.value)

async function insertName() {
  const el: HTMLTextAreaElement | null = messageField.value?.$el?.querySelector('textarea') ?? null
  const token = '{name}'
  if (!el) {
    message.value += token
    return
  }
  const start = el.selectionStart ?? message.value.length
  const end = el.selectionEnd ?? start
  message.value = message.value.slice(0, start) + token + message.value.slice(end)
  await nextTick()
  el.focus()
  el.setSelectionRange(start + token.length, start + token.length)
}

// Mirrors the server's recipient building so the counts here match what the
// campaign will show. Split in two so typing the message never redoes the
// number checks.

// Number checks: depend on the selection only.
const recipientCheck = computed(() => {
  const byId = new Map(customers.value.map(c => [c._id, c]))
  const seen = new Set<string>()
  let invalid = 0
  let duplicates = 0
  const rows: CustomerRow[] = []
  for (const id of selected.value) {
    const c = byId.get(id)
    if (!c) continue
    const to = toNotifyNumber(c.mobileNumber)
    if (!to) { invalid += 1; continue }
    if (seen.has(to)) { duplicates += 1; continue }
    seen.add(to)
    rows.push(c)
  }
  return { rows, invalid, duplicates }
})

// The template is measured once without its {name} tokens; each customer then
// only adds their name's measure, instead of every keystroke rebuilding and
// re-scanning 3,000 full messages. Repeated names are looked up, not redone.
const NAME_TOKEN = /\{name\}/gi

const stats = computed(() => {
  const { rows, invalid, duplicates } = recipientCheck.value
  let tooLong = 0
  let credits = 0
  let minParts = Infinity
  let maxParts = 0
  const sendableRows: CustomerRow[] = []

  if (!message.value) {
    sendableRows.push(...rows)
  } else {
    const tokens = (message.value.match(NAME_TOKEN) || []).length
    const base = measureText(message.value.replace(NAME_TOKEN, ''))
    const byName = new Map<string, { parts: number; tooLong: boolean }>()
    for (const c of rows) {
      const key = tokens ? greetingName(c) : ''
      let result = byName.get(key)
      if (!result) {
        const name = measureText(key)
        const whole = {
          gsm: base.gsm && name.gsm,
          gsmUnits: base.gsmUnits + tokens * name.gsmUnits,
          codePoints: base.codePoints + tokens * name.codePoints,
        }
        result = { parts: infoFromMeasure(whole).parts, tooLong: whole.codePoints > maxLength.value }
        byName.set(key, result)
      }
      if (result.tooLong) { tooLong += 1; continue }
      credits += result.parts
      minParts = Math.min(minParts, result.parts)
      maxParts = Math.max(maxParts, result.parts)
      sendableRows.push(c)
    }
  }

  return {
    sendable: sendableRows.length,
    first: sendableRows[0] ?? null,
    invalid,
    duplicates,
    tooLong,
    skipped: invalid + duplicates + tooLong,
    credits,
    minParts: minParts === Infinity ? 0 : minParts,
    maxParts,
  }
})

const previewCustomer = computed(() => stats.value.first)
const previewText = computed(() =>
  message.value ? renderMessage(message.value, previewCustomer.value ?? { firstName: 'Customer' }) : '',
)

// --- Step 3: review ----------------------------------------------------------
const estimatedSeconds = computed(() => {
  const cfg = config.value
  if (!cfg || !stats.value.sendable) return 0
  return Math.ceil(stats.value.sendable / cfg.concurrency) * (cfg.batchDelayMs / 1000 + 0.5)
})

const testNumber = ref('')
const testing = ref(false)

async function sendTest() {
  testing.value = true
  try {
    const res = await sendTestSms({ to: testNumber.value, message: message.value })
    if (res.ok) showToast('Test SMS accepted by Notify.lk. Check the phone.', 'success')
    else showToast(`Test SMS not sent: ${res.reason || res.outcome}`, 'error')
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to send test SMS', 'error')
  } finally {
    testing.value = false
  }
}

// --- navigation ----------------------------------------------------------------
const step1Valid = computed(() => !!name.value.trim() && stats.value.sendable > 0)
const step2Valid = computed(() => !!message.value.trim() && !templateTooLong.value && stats.value.sendable > 0)
const maxReachableStep = computed(() => (step1Valid.value ? (step2Valid.value ? 3 : 2) : 1))
const canContinue = computed(() => (step.value === 1 ? step1Valid.value : step2Valid.value))

const confirmDialog = ref(false)
const creating = ref(false)

async function start() {
  creating.value = true
  try {
    const user = getUser()
    const campaign = await createCampaign({
      name: name.value.trim(),
      message: message.value,
      customerIds: selected.value,
      createdBy: fullName(user || {}) || user?.userName,
    })
    confirmDialog.value = false
    showToast('Campaign started', 'success')
    router.replace(`/bulk-sms/${campaign._id}`)
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to start the campaign', 'error')
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  getSmsConfig().then(c => { config.value = c }).catch(() => {})
  loadingCustomers.value = true
  try {
    const data = await getAllCustomers()
    customers.value = data.map((c: any) => ({ ...c, fullName: fullName(c) }))
  } catch {
    showToast('Failed to load customers', 'error')
  } finally {
    loadingCustomers.value = false
  }
})
</script>

<style scoped>
.sms-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px) - var(--osk-h, 0px));
  box-sizing: border-box;
}
.step-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
}
.step-pill:disabled {
  cursor: default;
  opacity: 0.6;
}
.step-pill__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #374151;
  font-size: 0.75rem;
}
.step-pill--active {
  border-color: #0f766e;
  color: #0f766e;
}
.step-pill--active .step-pill__num,
.step-pill--done .step-pill__num {
  background: #0f766e;
  color: #fff;
}
.sms-bubble {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 0.875rem;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 60px;
}
.review-table {
  width: 100%;
  font-size: 0.875rem;
  border-collapse: collapse;
}
.review-table th {
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  padding: 6px 16px 6px 0;
  width: 160px;
  vertical-align: top;
}
.review-table td {
  padding: 6px 0;
  color: #111827;
}
</style>
