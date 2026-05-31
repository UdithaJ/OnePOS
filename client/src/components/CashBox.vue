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
          <v-icon color="yellow-darken-2" class="mr-2">mdi-currency-usd</v-icon>
          <span class="text-h4 font-weight-bold">
            ${{ activeSession.openingAmount.toFixed(2) }}
          </span>
        </div>
        <div class="mb-1">
          <v-icon class="mr-1" size="18">mdi-clock-outline</v-icon>
          Open: {{ formatDate(activeSession.openedAt) }}
        </div>
        <div v-if="activeSession.businessDate" class="mb-1">
          <v-icon class="mr-1" size="18">mdi-calendar</v-icon>
          Business Date: <span class="font-weight-bold">{{ formatBusinessDate(activeSession.businessDate) }}</span>
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
    <v-dialog v-model="showOpenDialog" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Open Cash Box Session</v-card-title>
        <v-card-text>
          <div class="mb-2"><strong>Opening Amount:</strong> $0.00</div>
          <div class="mb-4"><strong>User:</strong> {{ getUser()?.name || getUser()?._id }}</div>
          <v-text-field
            v-model="businessDateInput"
            label="Business Date"
            type="date"
            :rules="[v => !!v || 'Business date is required']"
            hint="The day this session represents. Defaults to today; pick tomorrow when opening late-night for the next day."
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" text @click="showOpenDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="actionLoading" @click="confirmStartSession">Open</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmationDialog
      v-model="showCloseDialog"
      title="Close Cash Box Session"
      @confirm="confirmCloseSession"
    >
      <div>
        <div><strong>Opening Amount:</strong> ${{ activeSession?.openingAmount?.toFixed(2) }}</div>
        <div><strong>Opened At:</strong> {{ formatDate(activeSession?.openedAt) }}</div>
        <div><strong>User:</strong> {{ getUser()?.name || getUser()?._id }}</div>
      </div>
    </ConfirmationDialog>
    <ExpenseDialog
      v-if="activeSession"
      v-model="showExpenseDialog"
      :session-id="activeSession._id"
    />
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { getActiveCashBoxSession, createCashBoxSession, closeCashBoxSession } from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
import ConfirmationDialog from './ConfirmationDialog.vue'
import ExpenseDialog from './ExpenseDialog.vue'

const loading = ref(true)
const actionLoading = ref(false)
const activeSession = ref<any | null>(null)
const { getUser } = useAuth()
const showOpenDialog = ref(false)
const showCloseDialog = ref(false)
const showExpenseDialog = ref(false)
const businessDateInput = ref<string>(todayIsoDate())

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString()
}

function formatBusinessDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}

async function fetchSession() {
  loading.value = true
  try {
    activeSession.value = await getActiveCashBoxSession()
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
  businessDateInput.value = todayIsoDate()
  showOpenDialog.value = true
}
function openCloseDialog() {
  showCloseDialog.value = true
}

async function confirmStartSession() {
  actionLoading.value = true
  try {
    const user = getUser()
    const openingAmount = 0
    await createCashBoxSession({
      openingAmount,
      openedBy: user?._id,
      businessDate: businessDateInput.value || todayIsoDate(),
    })
    showOpenDialog.value = false
    await fetchSession()
  } finally {
    actionLoading.value = false
  }
}

async function confirmCloseSession() {
  actionLoading.value = true
  try {
    const user = getUser()
    const closingAmount = activeSession.value.openingAmount
    await closeCashBoxSession(activeSession.value._id, { closingAmount, closedBy: user?._id })
    await fetchSession()
  } finally {
    actionLoading.value = false
  }
}

onMounted(fetchSession)
</script>