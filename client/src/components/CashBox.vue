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
        <div><strong>Opening Amount:</strong> $0.00</div>
        <div><strong>User:</strong> {{ getUser()?.name || getUser()?._id }}</div>
      </div>
    </ConfirmationDialog>
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
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { getActiveCashBoxSession, createCashBoxSession, closeCashBoxSession } from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
import ConfirmationDialog from './ConfirmationDialog.vue'

const loading = ref(true)
const actionLoading = ref(false)
const activeSession = ref<any | null>(null)
const { getUser } = useAuth()
const showOpenDialog = ref(false)
const showCloseDialog = ref(false)

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString()
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
    await createCashBoxSession({ openingAmount, openedBy: user?._id })
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