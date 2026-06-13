<template>
  <div class="orders-ui-redesign neomorphic-container">
    <main class="main-content neomorphic-container">
      <header class="header neomorphic-card">
        <div class="breadcrumbs">Laundromat · Orders</div>
        <div class="title-search">
          <input class="search" type="text" placeholder="Search orders..." />
          <button class="new-order" @click="handleNewOrderClick">+ New order</button>
        </div>
        <!-- Status button filters removed as requested -->
      </header>
      <section class="orders-list">
        <v-alert v-if="errorMsg" type="error" class="mb-4 neomorphic-card">{{ errorMsg }}</v-alert>
        <v-skeleton-loader v-if="loading" type="table" class="mb-4 neomorphic-card" :loading="loading" />
        <div class="neomorphic-card">
          <BaseList
            v-if="!loading && !errorMsg"
            :headers="orderHeaders"
            :items="orders"
            @add="handleAddOrder"
            @edit="onEditOrder"
          />
        </div>
      </section>
      <v-dialog v-model="showForm" max-width="900" scrim>
        <template #default>
          <v-card class="order-modal-card pa-6 neomorphic-card">
            <DynamicForm
              :schema="orderFormSchema"
              :form="form"
              :isValid="isValid"
              :onSubmit="handleSubmit"
              :hideDefaultSubmit="true"
            >
              <template #default>
                <div class="order-form-row">
                  <div class="order-form-field">
                    <v-autocomplete
                      v-model="form.customer"
                      :items="orderFormSchema.fields[0].options"
                      label="Customer"
                      :rules="[v => !!v || 'Customer is required']"
                      required
                      class="modal-form"
                    />
                  </div>
                  <div class="order-form-field">
                    <v-text-field
                      v-model="form.deliveryDate"
                      label="Delivery date"
                      type="date"
                      :rules="[v => !!v || 'Delivery date is required']"
                      required
                      class="modal-form"
                    />
                  </div>
                </div>
              </template>
              <template #suborders>
                <div class="order-suborders-section">
                  <div class="order-suborders-header">
                    <div class="suborders-label">
                      <span>Suborders</span>
                      <span class="suborders-badge">{{ suborders.length }}</span>
                    </div>
                    <v-btn color="primary" class="add-suborder-btn" @click="addSuborder" variant="outlined">+ Add suborder</v-btn>
                  </div>
                  <div class="suborder-table">
                    <div v-for="(sub, idx) in suborders" :key="idx" class="suborder-row">
                      <v-select
                        v-model="sub.category"
                        :items="categories"
                        item-title="label"
                        item-value="value"
                        label="Category"
                        :rules="[v => !!v || 'Category is required']"
                        class="modal-form suborder-field small-field"
                        @change="() => updateSuborderAmount(idx)"
                        required
                      />
                      <v-text-field
                        v-model="sub.weight"
                        label="Weight (kg)"
                        type="number"
                        :rules="[v => !!v || 'Weight is required']"
                        class="modal-form suborder-field small-field"
                        @input="() => updateSuborderAmount(idx)"
                        required
                      />
                      <v-text-field
                        :value="sub.amount"
                        label="Amount"
                        type="number"
                        readonly
                        class="modal-form suborder-field small-field"
                      />
                      <v-btn icon color="error" class="modal-form delete-btn" @click="removeSuborder(idx)"><v-icon>mdi-delete</v-icon></v-btn>
                    </div>
                  </div>
                  <v-divider class="order-divider" />
                  <div class="order-total-row">
                    <span class="order-total-label">Order total</span>
                    <span class="order-total-amount">LKR {{ totalAmount.toFixed(2) }}</span>
                  </div>
                  <v-btn color="primary" class="submit-order-btn" type="submit" block variant="outlined">Submit order</v-btn>
                </div>
              </template>
            </DynamicForm>
            <template v-if="editOrderId">
              <v-divider class="my-4" />
              <div v-if="payments.length > 0" class="payment-list-section">
                <div class="payment-list-header">Payments Made</div>
                <v-list dense>
                  <v-list-item v-for="(p, idx) in payments" :key="idx">
                    <v-list-item-content>
                      <v-list-item-title>
                        {{ p.date ? new Date(p.date).toLocaleString() : '' }} - {{ p.amount }} ({{ p.paymentMethod }})
                      </v-list-item-title>
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </div>
              <div class="due-amount-section">
                <span class="due-label">Due Amount:</span>
                <span class="due-value">LKR {{ dueAmount.toFixed(2) }}</span>
              </div>
              <v-btn color="success" class="modal-form" @click="showPaymentDialog = true">Make Payment</v-btn>
            </template>
          </v-card>
        </template>
      </v-dialog>
      <OrderPaymentDialog
        v-if="editOrderId"
        :show="showPaymentDialog"
        :order-id="editOrderId"
        :due-amount="dueAmount"
        @close="showPaymentDialog = false"
        @paid="onPaymentMade"
      />
    </main>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed, watch } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import OrderPaymentDialog from './OrderPaymentDialog.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { getActiveCashBoxSession } from '../services/cashBoxSessionApiService'
import { useAuth } from '../composables/useAuth'
const { getUser } = useAuth()

const orderHeaders = [
  { title: 'Order #', key: 'id', align: 'start' },
  { title: 'Customer', key: 'customer', align: 'start' },
  { title: 'Status', key: 'status', align: 'start' },
  { title: 'Total', key: 'total', align: 'end' },
  { title: 'Payment Status', key: 'paymentStatus', align: 'end' },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
]

import { getAllOrders, getOrderById, updateOrder } from '@/services/orderApiService'
import { getPaymentsByOrder } from '../services/getPaymentsByOrder'
const payments = ref<any[]>([])
const dueAmount = computed(() => {
  const paid = payments.value.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  return totalAmount.value - paid
})

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
    const computed = Number(sub.weight) * Number(cat.unitPrice)
    const floor = Number(cat.minimumPrice) || 0
    sub.amount = Math.max(computed, floor)
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
async function onPaymentMade(payment: any) {
  // Call payment API
  try {
    const activeSession = await getActiveCashBoxSession();
    const user = getUser();
    
    // Validate that both session and user exist before allowing payment
    if (!activeSession) {
      showToast('No active cash box session. Please open one first.', 'warning');
      return;
    }
    if (!user) {
      showToast('User information not found. Please log in again.', 'warning');
      return;
    }
    
    await makePayment({
      orderId: editOrderId.value || '',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      type: payment.type,
      sessionId: activeSession._id,
      userId: user._id
    })
    
    showToast('Payment successful!', 'success')
    
    // Reload payments to update due amount
    payments.value = await getPaymentsByOrder(editOrderId.value || '')
    
    // Check if order is fully paid
    if (dueAmount.value <= 0) {
      // Auto-update order status to completed when fully paid
      await updateOrder(editOrderId.value || '', {
        status: 'completed'
      })
      showToast('Order marked as completed!', 'success')
      await loadOrders()
      showForm.value = false
      editOrderId.value = null
      showPaymentDialog.value = false
    } else {
      showPaymentDialog.value = false
    }
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
      categories.value = categoryData.map((cat: any) => ({
        label: cat.name,
        value: cat._id,
        unitPrice: cat.unitPrice,
        minimumPrice: cat.minimumPrice,
      }))
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
  orders.value = (orderData || []).map((order: any) => {
    // Determine payment status based on order status
    let paymentStatus = 'Not Paid'
    if (order.status === 'completed') {
      paymentStatus = 'Paid'
    }
    return {
      id: order._id,
      customer: customers.value.find(c => c.value === (order.customerID?._id || order.customerID))?.label || order.customerID,
      status: order.status,
      total: typeof order.totalAmount === 'number' ? `LKR ${order.totalAmount.toFixed(2)}` : order.totalAmount,
      paymentStatus
    }
  })
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
    const cat = categories.value.find((c: any) => c.value === categoryId);
    let weight = sub.weight || '';
    let amount = 0;
    if (cat && weight) {
      const computed = Number(weight) * Number(cat.unitPrice);
      const floor = Number(cat.minimumPrice) || 0;
      amount = Math.max(computed, floor);
    }
    return {
      category: categoryId,
      weight,
      amount
    };
  });
  // Fetch payments for this order
  payments.value = await getPaymentsByOrder(orderId)
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

async function handleNewOrderClick() {
  const activeSession = await getActiveCashBoxSession();
  if (!activeSession) {
    showToast('No active cash box session. Please open one first.', 'warning');
    return;
  }
  showForm.value = true;
  editOrderId.value = null;
  resetForm();
}

async function handleAddOrder() {
  await handleNewOrderClick();
}
</script>
