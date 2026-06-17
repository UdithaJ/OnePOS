<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
    <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
      <v-icon color="white" size="20">mdi-cash</v-icon>
      <span class="text-white text-sm font-medium">Cash Box</span>
    </div>

    <div class="px-5 py-5">
      <template v-if="loading">
        <v-progress-circular indeterminate color="#0f766e" />
      </template>
      <template v-else-if="activeSession">
        <div class="flex items-center gap-2 mb-3">
          <v-icon color="#0f766e">mdi-currency-inr</v-icon>
          <span class="text-3xl font-bold text-gray-900">
            Rs {{ displayAmount.toFixed(2) }}
          </span>
        </div>
        <div class="text-sm text-gray-500 mb-1">Current cashbox amount</div>
        <div class="text-sm text-gray-500 mb-1">
          <v-icon size="16" class="mr-1">mdi-clock-outline</v-icon>
          Open: {{ formatDate(activeSession.openedAt) }}
        </div>
        <div class="text-sm text-gray-500">
          <v-icon size="16" class="mr-1">mdi-checkbox-marked-circle-outline</v-icon>
          Status: <span class="font-semibold text-gray-700">{{ activeSession.status }}</span>
        </div>
      </template>
      <template v-else>
        <div class="text-gray-500 text-sm">No active cash box session.</div>
      </template>
    </div>

    <div class="px-5 pb-5 flex items-center justify-between">
      <template v-if="activeSession">
        <v-btn
          color="error"
          variant="outlined"
          style="text-transform: none;"
          @click="openCloseDialog"
          :loading="actionLoading"
          :disabled="actionLoading"
        >Close Cash Box</v-btn>
        <div class="flex gap-2">
          <v-btn icon="mdi-plus" size="small"
            style="background: #0f766e; color: #ffffff;"
            @click="showInflowDialog = true" />
          <v-btn icon="mdi-minus" size="small"
            style="background: #7f1d1d; color: #ffffff;"
            @click="showExpenseDialog = true" />
        </div>
      </template>
      <template v-else>
        <v-btn
          style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
          @click="openSessionDialog"
          :loading="actionLoading"
          :disabled="actionLoading"
        >Start New Session</v-btn>
      </template>
    </div>

    <ConfirmationDialog
      v-model="showOpenDialog"
      title="Open Cash Box Session"
      @confirm="confirmStartSession"
    >
      <div>
        <div class="text-sm text-gray-600 mb-1"><strong>Opening Amount:</strong> Rs {{ suggestedOpeningAmount.toFixed(2) }}</div>
        <div class="text-sm text-gray-600 mb-3"><strong>User:</strong> {{ userDisplayName() }}</div>
        <v-text-field
          v-model="sessionStartDateTime"
          label="Session Start Date & Time"
          type="datetime-local"
          required
          variant="outlined"
          density="compact"
        />
      </div>
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showCloseDialog"
      title="Close Cash Box Session"
      @confirm="confirmCloseSession"
    >
      <div>
        <div class="text-sm text-gray-600 mb-1"><strong>Closing Amount:</strong> Rs {{ displayAmount.toFixed(2) }}</div>
        <div class="text-sm text-gray-600 mb-1"><strong>Opening Amount:</strong> Rs {{ activeSession?.openingAmount?.toFixed(2) }}</div>
        <div class="text-sm text-gray-600 mb-1"><strong>Opened At:</strong> {{ formatDate(activeSession?.openedAt) }}</div>
        <div class="text-sm text-gray-600"><strong>User:</strong> {{ userDisplayName() }}</div>
      </div>
    </ConfirmationDialog>

    <ExpenseDialog
      v-if="activeSession"
      v-model="showInflowDialog"
      :session-id="activeSession._id"
      flow-type="inflow"
      @saved="fetchSession"
    />
    <ExpenseDialog
      v-if="activeSession"
      v-model="showExpenseDialog"
      :session-id="activeSession._id"
      flow-type="outflow"
      @saved="fetchSession"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import {
  getActiveCashBoxSession,
  createCashBoxSession,
  closeCashBoxSession,
  getCashBoxSessionBalance,
  getLastClosedCashBoxSession,
} from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
import ConfirmationDialog from './ConfirmationDialog.vue'
import ExpenseDialog from './ExpenseDialog.vue'

const loading = ref(true)
const actionLoading = ref(false)
const activeSession = ref<any | null>(null)
const currentAmount = ref<number | null>(null)
const { getUser } = useAuth()

function userDisplayName() {
  const u = getUser();
  if (!u) return 'Unknown';
  const first = (u.firstName || '').trim();
  const last = (u.lastName || '').trim();
  const name = `${first} ${last}`.trim();
  return name || u.userName || u._id || 'Unknown';
}

const showOpenDialog = ref(false)
const showCloseDialog = ref(false)
const sessionStartDateTime = ref<string>("")
const showExpenseDialog = ref(false)
const suggestedOpeningAmount = ref<number>(0)
const showInflowDialog = ref(false)

const displayAmount = computed(() => {
  if (typeof currentAmount.value === 'number') return currentAmount.value
  return Number(activeSession.value?.openingAmount || 0)
})

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString()
}

async function fetchSession() {
  loading.value = true
  try {
    activeSession.value = await getActiveCashBoxSession()
    if (activeSession.value?._id) {
      const balance = await getCashBoxSessionBalance(activeSession.value._id)
      currentAmount.value = Number(balance.currentAmount || 0)
    } else {
      currentAmount.value = null
    }
  } finally {
    loading.value = false
  }
}

async function openSessionDialog() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  sessionStartDateTime.value = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  try {
    const lastClosed = await getLastClosedCashBoxSession();
    suggestedOpeningAmount.value = Number(lastClosed?.closingAmount || 0);
  } catch (err) {
    suggestedOpeningAmount.value = 0;
  }
  showOpenDialog.value = true;
}
function openCloseDialog() {
  showCloseDialog.value = true
}

async function confirmStartSession() {
  actionLoading.value = true
  try {
    const user = getUser();
    const openingAmount = Number(suggestedOpeningAmount.value || 0);
    let openedAt = sessionStartDateTime.value
      ? new Date(sessionStartDateTime.value).toISOString()
      : new Date().toISOString();
    await createCashBoxSession({ openingAmount, openedBy: user?._id, openedAt });
    await fetchSession();
  } finally {
    actionLoading.value = false;
  }
}

async function confirmCloseSession() {
  actionLoading.value = true
  try {
    const user = getUser();
    const closingAmount = displayAmount.value;
    const payload = {
      closingAmount,
      closedBy: user?._id,
      status: 'closed',
    };
    console.debug('[DEBUG] closeCashBoxSession payload:', payload, 'sessionId:', activeSession.value._id);
    await closeCashBoxSession(activeSession.value._id, payload);
    await fetchSession();
  } catch (err) {
    console.error('[DEBUG] Error in confirmCloseSession:', err);
  } finally {
    actionLoading.value = false;
  }
}

onMounted(fetchSession)
</script>
