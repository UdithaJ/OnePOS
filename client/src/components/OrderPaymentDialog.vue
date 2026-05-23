<template>
  <v-dialog :model-value="show" @update:model-value="onDialogUpdate" max-width="400">
    <v-card>
      <v-card-title>Make Payment</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitPayment">
          <v-text-field v-model="amount" label="Amount" type="number" required />
          <v-select v-model="paymentMethod" :items="methods" label="Payment Method" required />
          <v-select v-model="type" :items="types" label="Type" required />
        </v-form>
      </v-card-text>
      <div v-if="errorMsg" class="error-message" style="color:red;">{{ errorMsg }}</div>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="submitPayment">Pay</v-btn>
        <v-btn text @click="$emit('close')">Cancel</v-btn>
      </v-card-actions>
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
const type = ref('settlement')
const methods = ['cash', 'card', 'bank', 'other']
const types = ['advance', 'full_payment', 'settlement']

watch(() => props.dueAmount, (val) => { amount.value = val })

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
  emit('paid', { amount: amount.value, paymentMethod: paymentMethod.value, type: type.value })
  emit('update:show', false)
  emit('close')
}
</script>
