<template>
  <div class="sms-page p-6">
    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap" style="flex: none;">
      <div class="flex items-center gap-3 min-w-0">
        <v-btn icon="mdi-arrow-left" variant="text" size="small" @click="router.push('/bulk-sms')" />
        <h2 class="text-2xl font-semibold text-gray-900 truncate">{{ campaign?.name || 'Campaign' }}</h2>
        <v-chip v-if="campaign" :color="statusInfo.color" variant="tonal">{{ statusInfo.label }}</v-chip>
      </div>
      <div v-if="campaign" class="flex gap-2">
        <v-btn
          v-if="campaign.status === 'sending'"
          prepend-icon="mdi-pause"
          variant="outlined"
          :loading="acting === 'pause'"
          style="text-transform: none;"
          @click="act('pause')"
        >Pause</v-btn>
        <v-btn
          v-if="campaign.status === 'paused'"
          prepend-icon="mdi-play"
          :loading="acting === 'resume'"
          style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
          @click="act('resume')"
        >Resume</v-btn>
        <v-btn
          v-if="campaign.status === 'sending' || campaign.status === 'paused'"
          prepend-icon="mdi-close"
          variant="outlined"
          color="red"
          style="text-transform: none;"
          @click="cancelDialog = true"
        >Cancel</v-btn>
        <v-btn
          v-if="campaign.status !== 'sending'"
          prepend-icon="mdi-delete-outline"
          variant="outlined"
          color="red"
          style="text-transform: none;"
          @click="deleteDialog = true"
        >Delete</v-btn>
      </div>
    </div>

    <template v-if="campaign">
      <v-alert
        v-if="campaign.status === 'paused' && campaign.pauseReason"
        :type="autoPaused ? 'error' : 'info'"
        variant="tonal"
        density="compact"
        class="mb-3"
        style="flex: none;"
      >
        {{ campaign.pauseReason }}<template v-if="autoPaused"> Fix this, then press Resume.</template>
      </v-alert>
      <v-alert v-if="campaign.status === 'sending'" type="info" variant="tonal" density="compact" class="mb-3" style="flex: none;">
        Sending in the background. You can leave this page; closing OnePOS pauses sending until it is opened again.
      </v-alert>

      <!-- Progress -->
      <v-card class="rounded-xl px-5 py-4 mb-3" style="border: 1px solid #e5e7eb; flex: none;" elevation="0">
        <div class="flex items-center gap-3 mb-3">
          <v-progress-linear :model-value="percent" :color="campaign.status === 'sending' ? 'blue' : '#0f766e'" height="10" rounded />
          <span class="text-sm text-gray-700 whitespace-nowrap">
            {{ finished(campaign.counts).toLocaleString() }} / {{ sendable(campaign.counts).toLocaleString() }}
            <span v-if="campaign.status === 'sending' && campaign.etaSeconds" class="text-gray-500">· {{ formatDuration(campaign.etaSeconds) }} left</span>
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <v-chip
            v-for="s in COUNT_ORDER"
            :key="s"
            :color="RECIPIENT_STATUS[s].color"
            :variant="statusFilter === s ? 'flat' : 'tonal'"
            size="small"
            :title="RECIPIENT_STATUS[s].hint"
            @click="toggleFilter(s)"
          >
            {{ RECIPIENT_STATUS[s].label }} {{ countFor(s).toLocaleString() }}
          </v-chip>
        </div>
        <div class="text-xs text-gray-500 mt-3">
          "Accepted" means Notify.lk accepted the SMS. Whether it reached the phone is shown in the Notify.lk dashboard.
          <span v-if="campaign.createdBy"> · Created by {{ campaign.createdBy }}</span> · {{ formatDateTime(campaign.createdAt) }}
          <span v-if="campaign.senderId"> · Sender ID {{ campaign.senderId }}</span>
        </div>
      </v-card>

      <!-- Recipients -->
      <v-card class="rounded-xl overflow-hidden pos-dialog" style="border: 1px solid #e5e7eb; flex: 1 1 auto; min-height: 0;">
        <div class="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3" style="flex: none;">
          <v-text-field
            v-model="search"
            placeholder="Search name or mobile…"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 260px;"
          />
          <v-chip v-if="statusFilter" closable size="small" @click:close="statusFilter = null">
            Showing: {{ RECIPIENT_STATUS[statusFilter].label }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="campaign.status !== 'cancelled'"
            prepend-icon="mdi-refresh"
            variant="outlined"
            :disabled="!campaign.counts.failed && !campaign.counts.unknown"
            style="text-transform: none;"
            @click="openResend"
          >Resend failed ({{ campaign.counts.failed }})</v-btn>
          <v-btn
            prepend-icon="mdi-download"
            variant="outlined"
            :loading="exporting"
            style="text-transform: none;"
            @click="exportCsv"
          >Export CSV</v-btn>
        </div>
        <div class="pos-dialog__body">
          <v-data-table-server
            :headers="headers"
            :items="recipients"
            :items-length="recipientsTotal"
            :loading="loadingRecipients"
            v-model:page="page"
            v-model:items-per-page="perPage"
            :items-per-page-options="[25, 50, 100]"
            item-value="_id"
            density="compact"
            fixed-header
            @update:options="loadRecipients"
          >
            <template #item.status="{ item }">
              <v-chip :color="RECIPIENT_STATUS[item.status].color" size="small" variant="tonal" :title="RECIPIENT_STATUS[item.status].hint">
                {{ RECIPIENT_STATUS[item.status].label }}
              </v-chip>
            </template>
            <template #item.reason="{ item }">
              <span class="text-xs text-gray-700">{{ item.reason }}</span>
            </template>
            <template #item.updatedAt="{ item }">
              <span class="text-xs text-gray-500 whitespace-nowrap">{{ formatDateTime(item.updatedAt) }}</span>
            </template>
          </v-data-table-server>
        </div>
      </v-card>

      <v-expansion-panels class="mt-3" style="flex: none;">
        <v-expansion-panel title="Message">
          <v-expansion-panel-text>
            <div class="whitespace-pre-wrap text-sm text-gray-800">{{ campaign.message }}</div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <div v-else-if="loadError" class="text-gray-600">{{ loadError }}</div>

    <!-- Resend -->
    <v-dialog v-model="resendDialog" max-width="460">
      <v-card class="rounded-xl overflow-hidden pos-dialog">
        <div class="pos-dialog__header bg-[#0d3d38] text-white px-6 py-4">
          <span class="text-base font-semibold">Resend</span>
        </div>
        <div class="pos-dialog__body px-6 py-5 text-sm text-gray-700">
          <p class="mb-3">
            Send again to the <strong>{{ campaign?.counts.failed ?? 0 }}</strong> customer(s) marked Failed.
            Customers who already have the SMS are not included.
          </p>
          <v-checkbox
            v-if="campaign?.counts.unknown"
            v-model="includeUnknown"
            density="compact"
            hide-details
            :label="`Also resend the ${campaign.counts.unknown} marked Unknown`"
          />
          <v-alert v-if="includeUnknown" type="warning" variant="tonal" density="compact" class="mt-2">
            Unknown SMS may already have reached the customer. Check the Notify.lk dashboard first, or they may get it twice.
          </v-alert>
          <p v-if="campaign?.status === 'paused'" class="mt-3 text-gray-500">The campaign is paused; press Resume to send them.</p>
        </div>
        <div class="pos-dialog__actions">
          <v-btn variant="outlined" style="text-transform: none;" @click="resendDialog = false">Cancel</v-btn>
          <v-btn
            :loading="acting === 'resend'"
            :disabled="!resendCount"
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="resend"
          >Resend {{ resendCount }}</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <DeleteCampaignDialog v-model="deleteDialog" :campaign="campaign" @deleted="router.replace('/bulk-sms')" />

    <!-- Cancel -->
    <v-dialog v-model="cancelDialog" max-width="420">
      <v-card class="rounded-xl overflow-hidden pos-dialog">
        <div class="pos-dialog__header bg-[#0d3d38] text-white px-6 py-4">
          <span class="text-base font-semibold">Cancel campaign?</span>
        </div>
        <div class="pos-dialog__body px-6 py-5 text-sm text-gray-700">
          The {{ ((campaign?.counts.pending ?? 0) + (campaign?.counts.retrying ?? 0)).toLocaleString() }} customer(s) not yet sent to
          will not get this SMS. SMS already sent cannot be taken back. A cancelled campaign cannot be restarted.
        </div>
        <div class="pos-dialog__actions">
          <v-btn variant="outlined" style="text-transform: none;" @click="cancelDialog = false">Keep sending</v-btn>
          <v-btn
            color="red"
            :loading="acting === 'cancel'"
            style="text-transform: none; font-weight: 600;"
            @click="act('cancel')"
          >Cancel campaign</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import {
  getCampaign, listRecipients, pauseCampaign, resumeCampaign, cancelCampaign, resendCampaign, exportRecipientsCsv,
  type SmsCampaign, type SmsRecipient, type RecipientStatus,
} from '@/services/smsApiService'
import {
  RECIPIENT_STATUS, COUNT_ORDER, campaignStatus, finished, sendable, formatDuration, formatDateTime,
} from './smsStatus'
import DeleteCampaignDialog from './DeleteCampaignDialog.vue'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const id = computed(() => String(route.params.id))
const campaign = ref<SmsCampaign | null>(null)
const loadError = ref('')

const statusInfo = computed(() => (campaign.value ? campaignStatus(campaign.value) : { label: '', color: 'grey' }))
const autoPaused = computed(() => campaign.value?.status === 'paused' && campaign.value.pauseReason !== 'Paused by user')
const percent = computed(() => {
  const c = campaign.value
  if (!c) return 0
  const total = sendable(c.counts)
  return total ? (finished(c.counts) / total) * 100 : 100
})

function countFor(s: RecipientStatus) {
  const c = campaign.value?.counts
  if (!c) return 0
  // In-flight sends are shown with pending; there are only ever a few.
  return s === 'pending' ? c.pending + c.sending : c[s]
}

async function loadCampaign() {
  try {
    campaign.value = await getCampaign(id.value)
    loadError.value = ''
  } catch (err: any) {
    if (!campaign.value) loadError.value = err?.response?.data?.message || 'Failed to load the campaign'
  }
}

// --- recipients table --------------------------------------------------------
const headers = [
  { title: 'Customer', key: 'name', sortable: false },
  { title: 'Mobile', key: 'mobileNumber', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Attempts', key: 'attempts', sortable: false, align: 'end' as const },
  { title: 'Reason / Notify.lk response', key: 'reason', sortable: false },
  { title: 'Updated', key: 'updatedAt', sortable: false },
]

const recipients = ref<SmsRecipient[]>([])
const recipientsTotal = ref(0)
const loadingRecipients = ref(false)
const page = ref(1)
const perPage = ref(50)
const search = ref('')
const statusFilter = ref<RecipientStatus | null>(null)

async function loadRecipients(quiet = false) {
  if (quiet !== true) loadingRecipients.value = true
  try {
    const status = statusFilter.value === 'pending' ? 'pending,sending' : statusFilter.value || undefined
    const res = await listRecipients(id.value, { status, search: search.value || undefined, page: page.value, limit: perPage.value })
    recipients.value = res.items
    recipientsTotal.value = res.total
  } catch {
    if (quiet !== true) showToast('Failed to load recipients', 'error')
  } finally {
    loadingRecipients.value = false
  }
}

function toggleFilter(s: RecipientStatus) {
  statusFilter.value = statusFilter.value === s ? null : s
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadRecipients() }, 300)
})
watch(statusFilter, () => { page.value = 1; loadRecipients() })

// --- actions -------------------------------------------------------------------
const acting = ref<string | null>(null)
const cancelDialog = ref(false)
const deleteDialog = ref(false)
const resendDialog = ref(false)
const includeUnknown = ref(false)
const exporting = ref(false)

const resendCount = computed(() => {
  const c = campaign.value?.counts
  if (!c) return 0
  return c.failed + (includeUnknown.value ? c.unknown : 0)
})

function openResend() {
  includeUnknown.value = false
  resendDialog.value = true
}

async function act(action: 'pause' | 'resume' | 'cancel') {
  acting.value = action
  try {
    const fn = { pause: pauseCampaign, resume: resumeCampaign, cancel: cancelCampaign }[action]
    campaign.value = await fn(id.value)
    cancelDialog.value = false
    loadRecipients(true)
  } catch (err: any) {
    showToast(err?.response?.data?.message || `Failed to ${action} the campaign`, 'error')
  } finally {
    acting.value = null
  }
}

async function resend() {
  acting.value = 'resend'
  try {
    const res = await resendCampaign(id.value, includeUnknown.value)
    campaign.value = res
    resendDialog.value = false
    showToast(`${res.requeued ?? resendCount.value} SMS queued to resend`, 'success')
    loadRecipients(true)
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'Failed to resend', 'error')
  } finally {
    acting.value = null
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const status = statusFilter.value === 'pending' ? 'pending,sending' : statusFilter.value || undefined
    const { blob, filename } = await exportRecipientsCsv(id.value, status)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    showToast('Failed to export', 'error')
  } finally {
    exporting.value = false
  }
}

// --- live refresh --------------------------------------------------------------
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  loadCampaign()
  timer = setInterval(async () => {
    if (campaign.value?.status !== 'sending') return
    await loadCampaign()
    loadRecipients(true)
  }, 3000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(searchTimer)
})
</script>

<style scoped>
.sms-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px) - var(--osk-h, 0px));
  box-sizing: border-box;
}
</style>
