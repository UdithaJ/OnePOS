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
        <v-alert
          v-if="!loading && !errorMsg && (overdueCount > 0 || dueSoonCount > 0)"
          :type="overdueCount > 0 ? 'error' : 'warning'"
          variant="tonal"
          class="mb-4"
        >
          <span v-if="dueSoonCount > 0">{{ dueSoonCount }} due soon</span>
          <span v-if="dueSoonCount > 0 && overdueCount > 0"> &middot; </span>
          <span v-if="overdueCount > 0">{{ overdueCount }} overdue</span>
        </v-alert>
        <v-skeleton-loader v-if="loading" type="table" class="mb-4 neomorphic-card" :loading="loading" />
        <div>
          <BaseList
            v-if="!loading && !errorMsg"
            theme="teal"
            :headers="orderHeaders"
            :items="orders"
            @add="handleAddOrder"
            @edit="onEditOrder"
          >
            <template #item.status="{ item }">
              <span>{{ item.status }}</span>
              <v-chip
                v-if="item.overdue"
                color="error"
                size="x-small"
                class="ml-2"
                label
              >Overdue</v-chip>
              <v-chip
                v-else-if="item.dueSoon"
                color="warning"
                size="x-small"
                class="ml-2"
                label
              >Due Soon</v-chip>
            </template>
          </BaseList>
        </div>
      </section>
      <v-dialog v-model="showCapacityWarning" max-width="480">
        <v-card class="rounded-xl overflow-hidden" style="border: none;">
          <div class="bg-[#0d3d38] text-white px-6 py-4">
            <span class="text-base font-semibold">Capacity warning</span>
          </div>
          <div class="bg-white px-6 pt-4 pb-2 text-gray-700 text-sm">
            <p>This order may not be deliverable by the chosen date.</p>
            <p class="mt-2">
              Pending work: <strong>{{ capacityResult?.pendingKg ?? 0 }} kg</strong><br />
              This order: <strong>{{ capacityResult?.newOrderKg ?? 0 }} kg</strong><br />
              Processable by due date: <strong>{{ capacityResult?.maxProcessableKg ?? 0 }} kg</strong>
              ({{ capacityResult?.daysUntilDue ?? 0 }} day(s) × {{ capacityResult?.capacityPerDayKg ?? 0 }} kg/day)
            </p>
            <p class="mt-2">Proceed anyway?</p>
          </div>
          <div class="bg-white flex justify-end gap-3 px-6 pb-4">
            <v-btn variant="outlined"
              style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
              @click="cancelCapacityWarning">Cancel</v-btn>
            <v-btn
              style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
              @click="confirmCapacityWarning">Proceed</v-btn>
          </div>
        </v-card>
      </v-dialog>
      <v-dialog v-model="showForm" max-width="900" scrim>
        <template #default>
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">{{ editOrderId ? 'Edit Order' : 'New Order' }}</h3>
              <v-btn icon="mdi-close" size="small" variant="text"
                style="color: rgba(255,255,255,0.8);" @click="showForm = false" />
            </div>
            <div class="bg-white px-6 pt-6 pb-4">
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
                    <div class="field-group">
                      <label class="field-label">Customer <span class="required-star">*</span></label>
                      <v-autocomplete
                        v-model="form.customer"
                        :items="orderFormSchema.fields[0].options"
                        placeholder="Select customer"
                        :rules="[v => !!v || 'Customer is required']"
                        required
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                      />
                    </div>
                  </div>
                  <div class="order-form-field">
                    <div class="field-group">
                      <label class="field-label">Delivery Date <span class="required-star">*</span></label>
                      <v-text-field
                        v-model="form.deliveryDate"
                        type="date"
                        :rules="[v => !!v || 'Delivery date is required']"
                        required
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                      />
                    </div>
                  </div>
                </div>
              </template>
              <template #suborders>
                <div class="order-suborders-section">
                  <div class="order-suborders-header">
                    <div class="suborders-label">
                      <span>Order Items</span>
                      <span class="suborders-badge">{{ suborders.length }}</span>
                    </div>
                    <v-btn class="add-suborder-btn" @click="addSuborder" variant="outlined"
                      style="border-color: #0f766e; color: #0f766e; text-transform: none;">+ Add Item</v-btn>
                  </div>
                  <div class="suborder-table">
                    <div v-for="(sub, idx) in suborders" :key="idx" class="suborder-row">
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Category <span class="required-star">*</span></label>
                        <v-select
                          v-model="sub.category"
                          :items="categories"
                          item-title="label"
                          item-value="value"
                          placeholder="Select"
                          :rules="[v => !!v || 'Category is required']"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          @change="() => updateSuborderAmount(idx)"
                          required
                        />
                      </div>
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Weight (kg) <span class="required-star">*</span></label>
                        <v-text-field
                          v-model="sub.weight"
                          placeholder="0"
                          type="number"
                          :rules="[v => !!v || 'Weight is required']"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          @input="() => updateSuborderAmount(idx)"
                          required
                        />
                      </div>
                      <div class="field-group suborder-field small-field">
                        <label class="field-label">Amount</label>
                        <v-text-field
                          :value="sub.amount"
                          placeholder="0"
                          type="number"
                          readonly
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                        />
                      </div>
                      <div class="delete-btn-wrapper">
                        <span class="delete-btn-spacer"></span>
                        <v-btn icon color="error" size="small" @click="removeSuborder(idx)"><v-icon size="18">mdi-delete</v-icon></v-btn>
                      </div>
                    </div>
                  </div>
                  <v-divider class="order-divider" />
                  <div class="order-total-row">
                    <span class="order-total-label">Total Amount</span>
                    <span class="order-total-amount">LKR {{ totalAmount.toFixed(2) }}</span>
                  </div>
                  <v-btn type="submit" block
                    style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600; height: 44px;">Submit order</v-btn>
                </div>
              </template>
            </DynamicForm>
            <template v-if="editOrderId">
              <v-divider class="mt-4 mb-3" />
              <div class="payments-section">
                <div v-if="payments.length > 0">
                  <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payments Made</div>
                  <div v-for="(p, idx) in payments" :key="idx" class="payment-row">
                    <span class="payment-date">{{ p.date ? new Date(p.date).toLocaleString() : '' }}</span>
                    <span class="payment-method">{{ p.paymentMethod }}</span>
                    <span class="payment-amount">LKR {{ Number(p.amount).toFixed(2) }}</span>
                  </div>
                  <v-divider class="my-3" />
                </div>
                <div class="due-row">
                  <span class="text-sm font-medium text-gray-600">Due Amount</span>
                  <span class="text-base font-bold" :style="{ color: dueAmount > 0 ? '#b45309' : '#0f766e' }">
                    LKR {{ dueAmount.toFixed(2) }}
                  </span>
                </div>
                <v-btn block class="mt-3"
                  style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600; height: 40px;"
                  @click="showPaymentDialog = true">Make Payment</v-btn>
              </div>
            </template>
            </div>
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
import { checkOrderCapacity, getSystemSettings, type CapacityCheckResult } from '@/services/systemSettingsApiService'
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
const showCapacityWarning = ref(false)
const capacityResult = ref<CapacityCheckResult | null>(null)
const dueSoonLeadDays = ref<number>(1)
const overdueCount = computed(() => orders.value.filter(o => o.overdue).length)
const dueSoonCount = computed(() => orders.value.filter(o => o.dueSoon).length)

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
    const [customerData, orderData, categoryData, settings] = await Promise.all([
      getAllCustomers(),
      getAllOrders(),
      getAllCategories(),
      getSystemSettings().catch(() => null)
    ])
    if (settings) {
      dueSoonLeadDays.value = Number(settings.dueSoonLeadDays) || 0
    }
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

const DAY_MS = 24 * 60 * 60 * 1000

function deliveryState(order: any): { overdue: boolean; dueSoon: boolean } {
  if (!order?.deliveryDate) return { overdue: false, dueSoon: false }
  if (order.status === 'completed' || order.status === 'cancelled') return { overdue: false, dueSoon: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(order.deliveryDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / DAY_MS)
  if (diffDays < 0) return { overdue: true, dueSoon: false }
  if (diffDays <= Math.max(0, Number(dueSoonLeadDays.value) || 0)) return { overdue: false, dueSoon: true }
  return { overdue: false, dueSoon: false }
}

function setOrdersFromData(orderData: any[]) {
  orders.value = (orderData || []).map((order: any) => {
    const { overdue, dueSoon } = deliveryState(order)
    const paymentStatusRaw = String(order.paymentStatus || '').toLowerCase()
    let paymentStatus = 'Not Paid'
    if (paymentStatusRaw === 'paid') paymentStatus = 'Paid'
    else if (paymentStatusRaw === 'partial') paymentStatus = 'Partially Paid'

    return {
      id: order._id,
      customer: customers.value.find(c => c.value === (order.customerID?._id || order.customerID))?.label || order.customerID,
      status: order.status,
      total: typeof order.totalAmount === 'number' ? `Rs ${order.totalAmount.toFixed(2)}` : order.totalAmount,
      paymentStatus,
      overdue,
      dueSoon,
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
  payments.value = []
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

async function persistOrder() {
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
}

async function handleSubmit() {
  try {
    if (!editOrderId.value && form.value.deliveryDate) {
      const totalKg = suborders.value.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
      try {
        const result = await checkOrderCapacity({
          deliveryDate: form.value.deliveryDate,
          weightKg: totalKg
        })
        if (!result.ok) {
          capacityResult.value = result
          showCapacityWarning.value = true
          return
        }
      } catch (e) {
        showToast('Capacity check unavailable; proceeding without it.', 'warning')
        console.error('Capacity check failed', e)
      }
    }
    await persistOrder()
  } catch (error) {
    showToast(editOrderId.value ? 'Order update failed' : 'Order creation failed', 'error');
    console.error('Order save failed', error);
  }
}

function cancelCapacityWarning() {
  showCapacityWarning.value = false
  capacityResult.value = null
}

async function confirmCapacityWarning() {
  showCapacityWarning.value = false
  capacityResult.value = null
  try {
    await persistOrder()
  } catch (error) {
    showToast('Order creation failed', 'error')
    console.error('Order save failed', error)
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
