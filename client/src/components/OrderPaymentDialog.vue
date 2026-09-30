<template>
  <v-dialog :model-value="show" @update:model-value="onDialogUpdate" max-width="420">
    <v-card class="rounded-xl overflow-hidden" style="border: none;">
      <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
        <span class="text-base font-semibold">Make Payment</span>
        <v-btn icon="mdi-close" size="small" variant="text"
          style="color: rgba(255,255,255,0.8);" @click="cancel" />
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
            item-title="title"
            item-value="value"
            label="Type"
            required
            variant="outlined"
          />
          <v-checkbox
            v-model="printBill"
            label="Print bill"
            color="teal"
            density="compact"
            hide-details
          />
        </v-form>
        <div v-if="errorMsg" class="text-red-500 text-sm mt-2">{{ errorMsg }}</div>
        <div class="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
          <v-btn
            variant="outlined"
            style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
            @click="cancel"
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
import { ref, watch } from 'vue'
import { toCents } from '@/utils/money'

// printBill is the initial state of the "Print bill" checkbox for this opening
// (ticked when the order was created with "Print bill" selected). The choice is
// reported with both `paid` and `cancel`, so the parent never has to rely on a
// flag left over from an earlier order.
const props = defineProps<{ show: boolean, orderId: string, dueAmount: number, printBill?: boolean }>()
const emit = defineEmits(['close', 'cancel', 'paid', 'update:show'])

const DEFAULT_TYPE = 'settlement'
const DEFAULT_METHOD = 'cash'

const amount = ref<number | string>(props.dueAmount)
const errorMsg = ref('')
const paymentMethod = ref(DEFAULT_METHOD)
const transactionId = ref('')
const type = ref(DEFAULT_TYPE)
const printBill = ref(!!props.printBill)
const methods = [
  { title: 'Cash', value: 'cash' },
  { title: 'Bank Transfer', value: 'bank' },
]
const types = [
  { title: 'Advance', value: 'advance' },
  { title: 'Full Payment', value: 'full_payment' },
  { title: 'Settlement', value: 'settlement' },
]

// The dialog stays mounted between openings — and across orders, since the
// parent only unmounts it when no order is being edited — so every opening
// starts from a clean form for the current order.
function resetForm() {
  type.value = DEFAULT_TYPE
  paymentMethod.value = DEFAULT_METHOD
  transactionId.value = ''
  amount.value = props.dueAmount
  errorMsg.value = ''
  printBill.value = !!props.printBill
}

watch(() => props.show, (open) => {
  if (open) resetForm()
})

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

// Cancel button, the X, Esc and clicking outside all mean "no payment".
function cancel() {
  emit('cancel', { printBill: printBill.value })
  emit('close')
}

function onDialogUpdate(val: boolean) {
  emit('update:show', val)
  if (!val) cancel()
}

async function submitPayment() {
  errorMsg.value = ''
  if (toCents(amount.value) > toCents(props.dueAmount)) {
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
    printBill: printBill.value,
  })
  emit('update:show', false)
  emit('close')
}
</script>
