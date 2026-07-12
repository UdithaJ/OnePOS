<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
    <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
      <v-icon color="white" size="20">mdi-bank</v-icon>
      <span class="text-white text-sm font-medium">Bank Transfers</span>
    </div>

    <div class="px-5 py-5">
      <template v-if="loading">
        <v-progress-circular indeterminate color="#0f766e" />
      </template>
      <template v-else-if="activeSession">
        <div class="flex items-center gap-2 mb-3">
          <v-icon color="#0f766e">mdi-currency-inr</v-icon>
          <span class="text-3xl font-bold text-gray-900">
            Rs {{ bankTransfers.toFixed(2) }}
          </span>
        </div>
        <div class="text-sm text-gray-500">Received via bank transfer this session</div>
      </template>
      <template v-else>
        <div class="text-gray-500 text-sm">No active cash box session.</div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import {
  getActiveCashBoxSession,
  getCashBoxSessionBalance,
} from '../services/cashBoxSessionApiService'

const loading = ref(true)
const activeSession = ref<any | null>(null)
const bankTransfers = ref<number>(0)

async function fetchBankTransfers() {
  loading.value = true
  try {
    activeSession.value = await getActiveCashBoxSession()
    if (activeSession.value?._id) {
      const balance = await getCashBoxSessionBalance(activeSession.value._id)
      bankTransfers.value = Number(balance.totalBankPayments || 0)
    } else {
      bankTransfers.value = 0
    }
  } finally {
    loading.value = false
  }
}

onMounted(fetchBankTransfers)

defineExpose({ fetchBankTransfers })
</script>
