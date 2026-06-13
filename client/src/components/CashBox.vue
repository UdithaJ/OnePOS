<template>
  <v-card color="secondary" dark>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-cash</v-icon>
      Cash Box
    </v-card-title>
    <v-card-text>
      <template v-if="loading">
        <v-progress-circular indeterminate color="primary" />
      </template>
      <template v-else-if="activeSession">
        <div class="d-flex align-center mb-2">
          <v-icon color="yellow-darken-2" class="mr-2">mdi-currency-inr</v-icon>
          <span class="text-h4 font-weight-bold">
            Rs {{ displayAmount.toFixed(2) }}
          </span>
        </div>
        <div class="mb-1 text-caption">
          Current cashbox amount
        </div>
        <div class="mb-1">
          <v-icon class="mr-1" size="18">mdi-clock-outline</v-icon>
          Open: {{ formatDate(activeSession.openedAt) }}
        </div>
        <div class="mb-1">
          <v-icon class="mr-1" size="18">mdi-checkbox-marked-circle-outline</v-icon>
          Status: <span class="font-weight-bold">{{ activeSession.status }}</span>
        </div>
      </template>
      <template v-else>
        <div>No active cash box session.</div>
      </template>
    </v-card-text>
    <v-card-actions class="d-flex flex-row justify-space-between">
      <template v-if="activeSession">
        <v-btn color="error" @click="openCloseDialog" :loading="actionLoading" :disabled="actionLoading">
          Close Cash Box
        </v-btn>
        <div>
          <v-btn icon="mdi-plus" color="success" size="small" class="mr-2" :disabled="true" />
          <v-btn icon="mdi-minus" color="warning" size="small" @click="showExpenseDialog = true" />
        </div>
      </template>
      <template v-else>
        <v-btn color="primary" @click="openSessionDialog" :loading="actionLoading" :disabled="actionLoading">
          Start New Session
        </v-btn>
      </template>
    </v-card-actions>
    <ConfirmationDialog
      v-model="showOpenDialog"
      title="Open Cash Box Session"
      @confirm="confirmStartSession"
    >
      <div>
        <div><strong>Opening Amount:</strong> Rs 0.00</div>
        <div><strong>User:</strong> {{ getUser()?.name || getUser()?._id }}</div>
        <div class="mt-2">
          <v-text-field
            v-model="sessionStartDateTime"
            label="Session Start Date & Time"
            type="datetime-local"
            required
          />
        </div>
      </div>
    </ConfirmationDialog>
    <ConfirmationDialog
      v-model="showCloseDialog"
      title="Close Cash Box Session"
      @confirm="confirmCloseSession"
    >
      <div>
        <div><strong>Opening Amount:</strong> Rs {{ activeSession?.openingAmount?.toFixed(2) }}</div>
        <div><strong>Opened At:</strong> {{ formatDate(activeSession?.openedAt) }}</div>
        <div><strong>User:</strong> {{ getUser()?.name || getUser()?._id }}</div>
      </div>
    </ConfirmationDialog>
    <ExpenseDialog
      v-if="activeSession"
      v-model="showExpenseDialog"
      :session-id="activeSession._id"
      @saved="fetchSession"
    />
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import {
  getActiveCashBoxSession,
  createCashBoxSession,
  closeCashBoxSession,
  getCashBoxSessionBalance,
} from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
import ConfirmationDialog from './ConfirmationDialog.vue'
import ExpenseDialog from './ExpenseDialog.vue'

const loading = ref(true)
const actionLoading = ref(false)
const activeSession = ref<any | null>(null)
const currentAmount = ref<number | null>(null)
const { getUser } = useAuth()

const showOpenDialog = ref(false)
const showCloseDialog = ref(false)
const sessionStartDateTime = ref<string>("");
const maxDateTime = new Date().toISOString().slice(0, 16);
const showExpenseDialog = ref(false)

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

async function startSession() {
  openSessionDialog()
}

async function closeSession() {
  openCloseDialog()
}

function openSessionDialog() {
  // Set default to current date-time in local format for input[type=datetime-local]
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  sessionStartDateTime.value = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  showOpenDialog.value = true;
}
function openCloseDialog() {
  showCloseDialog.value = true
}

async function confirmStartSession() {
  actionLoading.value = true
  try {
    const user = getUser();
    const openingAmount = 0;
    // Use selected date-time, fallback to now if empty
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