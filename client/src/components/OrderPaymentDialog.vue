<template>
  <v-dialog :model-value="show" @update:model-value="onDialogUpdate" max-width="420">
    <v-card class="rounded-xl overflow-hidden" style="border: none;">
      <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
        <span class="text-base font-semibold">Make Payment</span>
        <v-btn icon="mdi-close" size="small" variant="text"
          style="color: rgba(255,255,255,0.8);" @click="$emit('close')" />
      </div>
      <div class="bg-white px-6 pt-6 pb-4">
        <v-form @submit.prevent="submitPayment">
          <v-text-field
            v-model="amount"
            label="Amount"
            type="number"
            required
            variant="outlined"
            class="mb-3"
          />
          <v-select
            v-model="paymentMethod"
            :items="methods"
            label="Payment Method"
            required
            variant="outlined"
            class="mb-3"
          />
          <v-text-field
            v-if="paymentMethod === 'bank'"
            v-model="transactionId"
            label="Transaction ID"
            placeholder="Bank reference / transaction number"
            required
            variant="outlined"
            class="mb-3"
          />
          <v-select
            v-model="type"
            :items="types"
            label="Type"
            required
            variant="outlined"
          />
        </v-form>
        <div v-if="errorMsg" class="text-red-500 text-sm mt-2">{{ errorMsg }}</div>
        <div class="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
          <v-btn
            variant="outlined"
            style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
            @click="$emit('close')"
          >Cancel</v-btn>
          <v-btn
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
            @click="submitPayment"
          >Pay</v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineEmits, watch } from 'vue'

const props = defineProps<{ show: boolean, orderId: string, dueAmount: number }>()
const emit = defineEmits(['close', 'paid', 'update:show'])

const amount = ref(props.dueAmount)
const errorMsg = ref('')
const paymentMethod = ref('cash')
const transactionId = ref('')
const type = ref('settlement')
const methods = ['cash', 'card', 'bank', 'other']
const types = ['advance', 'full_payment', 'settlement']

watch(() => props.dueAmount, (val) => {
  if (type.value !== 'advance') {
    amount.value = val
  }
})

watch(type, (val) => {
  if (val === 'advance') {
    amount.value = ''
  } else {
    amount.value = props.dueAmount
  }
})

watch(paymentMethod, (val) => {
  if (val !== 'bank') transactionId.value = ''
})

function onDialogUpdate(val: boolean) {
  emit('update:show', val)
  if (!val) emit('close')
}

async function submitPayment() {
  errorMsg.value = ''
  if (Number(amount.value) > Number(props.dueAmount)) {
    errorMsg.value = 'Payment cannot exceed due amount.'
    return
  }
  if (Number(amount.value) <= 0) {
    errorMsg.value = 'Payment amount must be greater than zero.'
    return
  }
  if (paymentMethod.value === 'bank' && !transactionId.value.trim()) {
    errorMsg.value = 'Transaction ID is required for bank transfers.'
    return
  }
  emit('paid', {
    amount: amount.value,
    paymentMethod: paymentMethod.value,
    type: type.value,
    transactionId: paymentMethod.value === 'bank' ? transactionId.value.trim() : undefined,
  })
  emit('update:show', false)
  emit('close')
}
</script>
