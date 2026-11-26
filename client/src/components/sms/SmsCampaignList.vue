<template>
  <div class="sms-page p-6">
    <div class="flex items-center justify-between mb-6" style="flex: none;">
      <h2 class="text-2xl font-semibold text-gray-900 flex items-center gap-3">
        <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
        Bulk SMS
      </h2>
      <v-btn
        prepend-icon="mdi-plus"
        style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
        @click="router.push('/bulk-sms/new')"
      >New Campaign</v-btn>
    </div>

    <v-alert v-if="config && !config.configured" type="warning" variant="tonal" class="mb-4" style="flex: none;">
      Notify.lk credentials are not configured. Campaigns will pause until NOTIFY_USER_ID and NOTIFY_API_KEY are set.
    </v-alert>

    <v-card class="rounded-xl overflow-hidden pos-dialog" style="border: 1px solid #e5e7eb; flex: 1 1 auto; min-height: 0;">
      <div class="pos-dialog__body">
        <v-data-table
          :headers="headers"
          :items="campaigns"
          :loading="loading"
          item-value="_id"
          fixed-header
          hover
          class="campaign-table"
          no-data-text="No campaigns yet. Press New Campaign to send one."
          @click:row="(_e: unknown, { item }: { item: SmsCampaign }) => router.push(`/bulk-sms/${item._id}`)"
        >
          <template #item.createdAt="{ item }">
            <div>{{ formatDateTime(item.createdAt) }}</div>
            <div v-if="item.createdBy" class="text-xs text-gray-500">{{ item.createdBy }}</div>
          </template>
          <template #item.recipients="{ item }">
            {{ sendable(item.counts).toLocaleString() }}
            <span v-if="item.counts.skipped" class="text-xs text-gray-500">({{ item.counts.skipped }} skipped)</span>
          </template>
          <template #item.progress="{ item }">
            <div class="flex items-center gap-2" style="min-width: 180px;">
              <v-progress-linear
                :model-value="percent(item)"
                :color="item.status === 'sending' ? 'blue' : '#0f766e'"
                height="8"
                rounded
              />
              <span class="text-xs text-gray-600 whitespace-nowrap">
                {{ finished(item.counts).toLocaleString() }} / {{ sendable(item.counts).toLocaleString() }}
              </span>
            </div>
          </template>
          <template #item.status="{ item }">
            <v-chip :color="campaignStatus(item).color" size="small" variant="tonal">{{ campaignStatus(item).label }}</v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              v-if="item.status !== 'sending'"
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              color="red"
              title="Delete campaign"
              @click.stop="confirmDelete(item)"
            />
          </template>
        </v-data-table>
      </div>
    </v-card>

    <DeleteCampaignDialog v-model="deleteDialog" :campaign="toDelete" @deleted="onDeleted" />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { listCampaigns, getSmsConfig, type SmsCampaign, type SmsConfig } from '@/services/smsApiService'
import { campaignStatus, finished, sendable, formatDateTime } from '@/utils/smsCampaign'
import DeleteCampaignDialog from './DeleteCampaignDialog.vue'

const router = useRouter()
const { showToast } = useToast()

const campaigns = ref<SmsCampaign[]>([])
const config = ref<SmsConfig | null>(null)
const loading = ref(false)

const headers = [
  { title: 'Campaign', key: 'name', sortable: true },
  { title: 'Created', key: 'createdAt', sortable: true },
  { title: 'Recipients', key: 'recipients', sortable: false },
  { title: 'Progress', key: 'progress', sortable: false },
  { title: 'Status', key: 'status', sortable: true },
  { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 56 },
]

const deleteDialog = ref(false)
const toDelete = ref<SmsCampaign | null>(null)

function confirmDelete(c: SmsCampaign) {
  toDelete.value = c
  deleteDialog.value = true
}

function onDeleted(id: string) {
  campaigns.value = campaigns.value.filter(c => c._id !== id)
}

function percent(c: SmsCampaign) {
  const total = sendable(c.counts)
  return total ? (finished(c.counts) / total) * 100 : 100
}

const anySending = computed(() => campaigns.value.some(c => c.status === 'sending'))

async function load(showSpinner = false) {
  if (showSpinner) loading.value = true
  try {
    campaigns.value = await listCampaigns()
  } catch {
    if (showSpinner) showToast('Failed to load campaigns', 'error')
  } finally {
    loading.value = false
  }
}

// Refresh while something is sending, so progress moves on its own.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  load(true)
  getSmsConfig().then(c => { config.value = c }).catch(() => {})
  timer = setInterval(() => { if (anySending.value) load() }, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.sms-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px) - var(--osk-h, 0px));
  box-sizing: border-box;
}
.campaign-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
