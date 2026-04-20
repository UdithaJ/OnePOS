
<template>
  <div>
    <!-- Toast notification always in top right -->
    <div v-if="toast.show" :class="['toast', toast.type]" :style="toastStyle">
      {{ toast.message }}
    </div>
    <v-container>
      <h2 class="mb-4">Laundromat Orders</h2>
      <BaseList
        title="Orders"
        :headers="orderHeaders"
        :items="orders"
        @add="() => { showForm = true; editOrderId = null; resetForm(); }"
        @edit="onEditOrder"
      />
      <v-dialog v-model="showForm" max-width="700" scrim>
        <template #default>
          <v-card class="pa-6" style="background: #23272f; color: #fff;">
            <DynamicForm
              :schema="orderFormSchema"
              :form="form"
              :isValid="isValid"
              :onSubmit="handleSubmit"
            />
            <template v-if="editOrderId">
              <v-divider class="my-4" />
              <v-btn color="success" @click="showPaymentDialog = true">Make Payment</v-btn>
            </template>
          </v-card>
        </template>
      </v-dialog>
      <OrderPaymentDialog
        v-if="editOrderId"
        :show="showPaymentDialog"
        :order-id="editOrderId"
        :due-amount="form.totalAmount"
        @close="showPaymentDialog = false"
        @paid="onPaymentMade"
      />
    </v-container>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import OrderPaymentDialog from './OrderPaymentDialog.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'


const orderHeaders = [
  { title: 'Order #', key: 'id', align: 'start' },
  { title: 'Customer', key: 'customer', align: 'start' },
  { title: 'Status', key: 'status', align: 'start' },
  { title: 'Total', key: 'total', align: 'end' },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
]

import { getAllOrders, getOrderById, updateOrder } from '@/services/orderApiService'

const orders = ref<any[]>([])

const showForm = ref(false)
const editOrderId = ref<string|null>(null)
const showPaymentDialog = ref(false)
import { makePayment } from '@/services/paymentApiService'
async function onPaymentMade(payment) {
  // Call payment API
  try {
    await makePayment({
      orderId: editOrderId.value,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      type: payment.type
    })
    showToast('Payment successful!', 'success')
    await loadOrders()
    showPaymentDialog.value = false
  } catch (e) {
    showToast('Payment failed', 'error')
  }
}

import { onMounted } from 'vue'
import { getAllCustomers } from '@/services/customerApiService'
import { createOrder } from '@/services/orderApiService'
import { useToast, toastStyle } from '@/composables/useToast'
const { toast, showToast } = useToast()

const customers = ref([])

const ORDER_STATUSES = [
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const orderFormSchema = computed(() => ({
  fields: [
    { name: 'customer', label: 'Customer', type: 'autoselect', required: true, options: customers.value, allowFreeText: false },
    { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true },
    ...(editOrderId.value ? [
      { name: 'status', label: 'Status', type: 'select', required: true, options: ORDER_STATUSES },
      { name: 'rackNumber', label: 'Rack Number', type: 'text' },
    ] : [])
  ]
}))

import type { CustomerPayload } from '@/services/customerApiService'


async function loadCustomersAndOrders() {
  const [customerData, orderData] = await Promise.all([
    getAllCustomers(),
    getAllOrders()
  ])
  customers.value = (customerData || []).map((c: CustomerPayload & { _id: string }) => ({ label: c.firstName + ' ' + c.lastName, value: c._id }))
  setOrdersFromData(orderData)
}

function setOrdersFromData(orderData: any[]) {
  orders.value = (orderData || []).map((order: any) => ({
    id: order._id,
    customer: customers.value.find(c => c.value === (order.customerID?._id || order.customerID))?.label || order.customerID,
    status: order.status,
    total: typeof order.totalAmount === 'number' ? `$${order.totalAmount.toFixed(2)}` : order.totalAmount
  }))
}

async function loadOrders() {
  const orderData = await getAllOrders()
  setOrdersFromData(orderData)
}

onMounted(loadCustomersAndOrders)

const { form, isValid } = useDynamicForm({ fields: [] })
// Initialize all possible fields upfront
form.value.customer = ''
form.value.weight = ''
form.value.deliveryDate = ''
form.value.totalAmount = ''
form.value.status = ''
form.value.rackNumber = ''

function resetForm() {
  form.value.customer = ''
  form.value.weight = ''
  form.value.deliveryDate = ''
  form.value.totalAmount = ''
  form.value.status = ''
  form.value.rackNumber = ''
}

async function onEditOrder(order: any) {
  const orderId = order.id || order._id
  if (!orderId) return
  const data = await getOrderById(orderId)
  editOrderId.value = orderId
  form.value.customer = data.customerID?._id || data.customerID
  form.value.weight = data.weight
  form.value.deliveryDate = data.deliveryDate?.substring(0, 10)
  form.value.totalAmount = data.totalAmount
  form.value.status = data.status || 'todo'
  form.value.rackNumber = data.rackNumber || ''
  showForm.value = true
}

async function handleSubmit() {
  try {
    const payload = {
      customerID: form.value.customer,
      weight: form.value.weight,
      deliveryDate: form.value.deliveryDate,
      totalAmount: form.value.totalAmount,
    };
    if (editOrderId.value) {
      const editPayload = { ...payload, status: form.value.status, rackNumber: form.value.rackNumber }
      await updateOrder(editOrderId.value, editPayload)
      showToast('Order updated successfully!', 'success')
    } else {
      await createOrder(payload)
      showToast('Order created successfully!', 'success')
    }
    await loadOrders();
    showForm.value = false;
    editOrderId.value = null;
  } catch (error) {
    showToast(editOrderId.value ? 'Order update failed' : 'Order creation failed', 'error');
    console.error('Order save failed', error);
  }
}
</script>
