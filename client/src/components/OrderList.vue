<template>
  <v-container>
    <h2 class="mb-4">Laundromat Orders</h2>
    <BaseList
      title="Orders"
      :headers="orderHeaders"
      :items="tableRows"
      :loading="loadingList"
      @add="openCreate"
    />
    <v-dialog v-model="showForm" max-width="720" scrim>
      <v-card class="pa-6" style="background: #23272f; color: #fff;">
        <h3 class="mb-4">New order</h3>
        <v-form @submit.prevent="handleSubmit">
          <v-select
            v-model="form.customerID"
            label="Customer"
            :items="customers"
            item-title="displayName"
            item-value="_id"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            :rules="[v => !!v || 'Required']"
            required
          />
          <div class="text-subtitle-2 mb-2">Category lines</div>
          <v-card
            v-for="(line, idx) in lines"
            :key="idx"
            class="pa-3 mb-2"
            variant="outlined"
            color="surface-variant"
          >
            <v-row align="center">
              <v-col cols="12" md="6">
                <v-select
                  v-model="line.categoryId"
                  label="Category"
                  :items="activeCategories"
                  item-title="name"
                  item-value="_id"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="line.weight"
                  label="Weight (kg)"
                  type="number"
                  min="0"
                  step="0.01"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                />
              </v-col>
              <v-col cols="12" md="2" class="text-center">
                <v-btn
                  v-if="lines.length > 1"
                  variant="text"
                  color="error"
                  icon
                  size="small"
                  @click="removeLine(idx)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
          <v-btn class="mb-4" variant="tonal" size="small" @click="addLine">
            Add line
          </v-btn>
          <div class="text-h6 mb-4">
            Estimated total:
            <span class="text-primary">{{ formatMoney(estimatedTotal) }}</span>
          </div>
          <v-text-field
            v-model="form.deliveryDate"
            label="Delivery date"
            type="date"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            :rules="[v => !!v || 'Required']"
            required
          />
          <v-select
            v-model="form.status"
            label="Status"
            :items="statuses"
            item-title="displayName"
            item-value="_id"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            :rules="[v => !!v || 'Required']"
            required
          />
          <v-select
            v-model="form.paymentStatus"
            label="Payment status"
            :items="paymentOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="comfortable"
            class="mb-3"
          />
          <v-text-field
            v-model="form.createdUser"
            label="Created user ID (MongoDB ObjectId)"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            hint="24-character hex ID from your users collection"
            persistent-hint
            :rules="[isValidObjectIdRule]"
          />
          <v-text-field
            v-model="form.rackNumber"
            label="Rack number"
            variant="outlined"
            density="comfortable"
            class="mb-4"
          />
          <div class="d-flex gap-2">
            <v-btn type="submit" color="primary" :loading="submitting" :disabled="!canSubmit">
              Create order
            </v-btn>
            <v-btn variant="text" @click="showForm = false">Cancel</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import BaseList from '@/components/BaseList.vue'
import { getAllCategories, type Category } from '@/services/categoryApiService'
import { getAllCustomers } from '@/services/customerApiService'
import { createOrder, getOrders } from '@/services/orderApiService'
import { getAllStatuses, type StatusRow } from '@/services/statusApiService'
import { lineTotalForCategory } from '@/utils/orderPricing'

const orderHeaders = [
  { title: 'Order #', key: 'id', align: 'start' as const },
  { title: 'Customer', key: 'customer', align: 'start' as const },
  { title: 'Status', key: 'status', align: 'start' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
]

interface CustomerRow {
  _id: string
  firstName: string
  lastName: string
  displayName?: string
}

const orders = ref<any[]>([])
const loadingList = ref(false)
const customers = ref<CustomerRow[]>([])
const categories = ref<Category[]>([])
const statuses = ref<StatusRow[]>([])
const showForm = ref(false)
const submitting = ref(false)

const form = ref({
  customerID: '',
  deliveryDate: '',
  status: '',
  paymentStatus: 'unpaid' as 'unpaid' | 'partial' | 'paid',
  createdUser: '',
  rackNumber: '',
})

const lines = ref<Array<{ categoryId: string; weight: string }>>([
  { categoryId: '', weight: '' },
])

const paymentOptions = [
  { title: 'Unpaid', value: 'unpaid' },
  { title: 'Partial', value: 'partial' },
  { title: 'Paid', value: 'paid' },
]

const activeCategories = computed(() => categories.value.filter(c => c.isActive))

const estimatedTotal = computed(() => {
  let sum = 0
  for (const line of lines.value) {
    if (!line.categoryId || line.weight === '' || line.weight === null) continue
    const cat = categories.value.find(c => c._id === line.categoryId)
    if (!cat) continue
    sum += lineTotalForCategory(cat, Number(line.weight))
  }
  return sum
})

const tableRows = computed(() =>
  orders.value.map(o => ({
    id: String(o._id ?? '').slice(-6),
    customer: formatCustomerLabel(o.customerID),
    status: o.status?.displayName ?? o.status?.name ?? '—',
    total: formatMoney(o.totalAmount),
  }))
)

function formatMoney(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

function formatCustomerLabel(c: any): string {
  if (!c) return '—'
  if (typeof c === 'object' && c.firstName != null) {
    return `${c.firstName} ${c.lastName}`.trim()
  }
  return '—'
}

function isValidObjectIdRule(v: string) {
  if (!v) return 'Required'
  return /^[a-f0-9]{24}$/i.test(v.trim()) || 'Must be a 24-character hex ObjectId'
}

const canSubmit = computed(() => {
  if (!form.value.customerID || !form.value.deliveryDate || !form.value.status) return false
  if (!/^[a-f0-9]{24}$/i.test(form.value.createdUser.trim())) return false
  const validLines = lines.value.filter(
    l => l.categoryId && l.weight !== '' && Number(l.weight) >= 0
  )
  if (validLines.length < 1) return false
  return true
})

async function loadList() {
  loadingList.value = true
  try {
    orders.value = await getOrders()
  } catch {
    orders.value = []
  } finally {
    loadingList.value = false
  }
}

async function loadLookups() {
  try {
    const [cust, cats, sts] = await Promise.all([
      getAllCustomers(),
      getAllCategories(),
      getAllStatuses(),
    ])
    customers.value = (cust as any[]).map(c => ({
      ...c,
      displayName: `${c.firstName} ${c.lastName}`.trim(),
    }))
    categories.value = cats
    statuses.value = sts
  } catch {
    customers.value = []
    categories.value = []
    statuses.value = []
  }
}

onMounted(() => {
  loadList()
  loadLookups()
})

function resetForm() {
  form.value = {
    customerID: '',
    deliveryDate: '',
    status: '',
    paymentStatus: 'unpaid',
    createdUser: '',
    rackNumber: '',
  }
  lines.value = [{ categoryId: '', weight: '' }]
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function addLine() {
  lines.value.push({ categoryId: '', weight: '' })
}

function removeLine(idx: number) {
  lines.value.splice(idx, 1)
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const categoryLines = lines.value
      .filter(l => l.categoryId && l.weight !== '' && Number(l.weight) >= 0)
      .map(l => ({
        categoryId: l.categoryId,
        weight: Number(l.weight),
      }))
    await createOrder({
      customerID: form.value.customerID,
      categoryLines,
      deliveryDate: new Date(form.value.deliveryDate).toISOString(),
      status: form.value.status,
      paymentStatus: form.value.paymentStatus,
      createdUser: form.value.createdUser.trim(),
      rackNumber: form.value.rackNumber.trim() || undefined,
    })
    showForm.value = false
    await loadList()
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to create order'
    alert(String(msg))
  } finally {
    submitting.value = false
  }
}
</script>
