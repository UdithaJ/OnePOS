
<template>
  <div>
    <!-- Toast notification always in top right -->
    <div v-if="toast.show" :class="['toast', toast.type]" :style="toastStyle">
      {{ toast.message }}
    </div>
    <v-container>
      <h2 class="mb-4">Laundromat Orders</h2>
      <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>
      <v-skeleton-loader v-if="loading" type="table" class="mb-4" :loading="loading" />
      <BaseList
        v-if="!loading && !errorMsg"
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
            <div class="mt-4">
              <h4>Suborders</h4>
              <v-btn color="primary" @click="addSuborder">Add Suborder</v-btn>
              <div v-for="(sub, idx) in suborders" :key="idx" class="d-flex align-center mt-2">
                <v-select
                  v-model="sub.category"
                  :items="categories"
                  item-title="label"
                  item-value="value"
                  label="Category"
                  class="mr-2"
                  style="max-width: 180px"
                  @change="() => updateSuborderAmount(idx)"
                  required
                />
                <v-text-field
                  v-model="sub.weight"
                  label="Weight (kg)"
                  type="number"
                  class="mr-2"
                  style="max-width: 120px"
                  @input="() => updateSuborderAmount(idx)"
                  required
                />
                <v-text-field
                  :value="sub.amount"
                  label="Amount"
                  type="number"
                  readonly
                  style="max-width: 120px"
                  class="mr-2"
                />
                <v-btn icon color="error" @click="removeSuborder(idx)"><v-icon>mdi-delete</v-icon></v-btn>
              </div>
              <div class="mt-2 text-right">
                <strong>Total: {{ totalAmount }}</strong>
              </div>
            </div>
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

import { ref, computed, watch } from 'vue'
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
const categories = ref<any[]>([])
const suborders = ref<any[]>([])

function addSuborder() {
  suborders.value.push({ category: '', weight: '', amount: 0 })
}
function removeSuborder(idx: number) {
  suborders.value.splice(idx, 1)
}
function updateSuborderAmount(idx: number) {
  const sub = suborders.value[idx]
  const cat = categories.value.find((c: any) => c.value === sub.category)
  if (cat && sub.weight) {
    sub.amount = Number(sub.weight) * Number(cat.unitPrice)
  } else {
    sub.amount = 0
  }
}
const totalAmount = computed(() => suborders.value.reduce((sum, s) => sum + Number(s.amount || 0), 0))

// Watch suborders for changes to recalculate amounts
watch(suborders, (subs) => {
  subs.forEach((sub, idx) => updateSuborderAmount(idx))
}, { deep: true })
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

import { onMounted, ref } from 'vue'
import { getAllCustomers } from '@/services/customerApiService'
import { createOrder } from '@/services/orderApiService'
import { useToast, toastStyle } from '@/composables/useToast'
const { toast, showToast } = useToast()

const customers = ref([])
const loading = ref(false)
const errorMsg = ref('')

const ORDER_STATUSES = [
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const orderFormSchema = computed(() => ({
  fields: [
    { name: 'customer', label: 'Customer', type: 'autoselect', required: true, options: customers.value, allowFreeText: false },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    ...(editOrderId.value ? [
      { name: 'status', label: 'Status', type: 'select', required: true, options: ORDER_STATUSES },
      { name: 'rackNumber', label: 'Rack Number', type: 'text' },
    ] : [])
  ]
}))

import type { CustomerPayload } from '@/services/customerApiService'


import { getAllCategories } from '@/services/categoryApiService'
async function loadCustomersAndOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [customerData, orderData, categoryData] = await Promise.all([
      getAllCustomers(),
      getAllOrders(),
      getAllCategories()
    ])
    customers.value = (customerData || []).map((c: CustomerPayload & { _id: string }) => ({ label: c.firstName + ' ' + c.lastName, value: c._id }))
    if (Array.isArray(categoryData)) {
      categories.value = categoryData.map((cat: any) => ({ label: cat.name, value: cat._id, unitPrice: cat.unitPrice }))
    } else {
      categories.value = []
      console.error('Failed to load categories:', categoryData)
    }
    setOrdersFromData(orderData)
  } catch (err) {
    errorMsg.value = 'Failed to load orders or related data. Please try again.'
    console.error('Data load error:', err)
  } finally {
    loading.value = false
  }
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
  form.value.deliveryDate = ''
  form.value.status = ''
  form.value.rackNumber = ''
  suborders.value = []
}

async function onEditOrder(order: any) {
  const orderId = order.id || order._id
  if (!orderId) return
  const data = await getOrderById(orderId)
  editOrderId.value = orderId
  form.value.customer = data.customerID?._id || data.customerID
  form.value.deliveryDate = data.deliveryDate?.substring(0, 10)
  form.value.status = data.status || 'todo'
  form.value.rackNumber = data.rackNumber || ''
  // Map suborders to ensure category is the ID and amount is recalculated
  suborders.value = (data.suborders || []).map((sub: any) => {
    let categoryId = sub.category?._id || sub.category;
    // Find matching category for unitPrice
    const cat = categories.value.find((c: any) => c.value === categoryId);
    let weight = sub.weight || '';
    let amount = (cat && weight) ? Number(weight) * Number(cat.unitPrice) : 0;
    return {
      category: categoryId,
      weight,
      amount
    };
  });
  showForm.value = true
}

async function handleSubmit() {
  try {
    const payload = {
      customerID: form.value.customer,
      deliveryDate: form.value.deliveryDate,
      suborders: suborders.value,
      totalAmount: totalAmount.value,
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
