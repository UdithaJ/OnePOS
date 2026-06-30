<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      Customers
    </h2>

    <BaseList
      theme="teal"
      title="Customer List"
      :headers="customerHeaders"
      :items="customers"
      @add="onAddCustomer"
      @edit="onEditCustomer"
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" class="mr-2" @click="onEditCustomer(item)" />
        <v-btn icon="mdi-delete" size="small" color="error" @click="onDeleteCustomer(item)" />
      </template>
    </BaseList>

    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <div class="customer-form-wrapper">
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">{{ editId ? 'Edit Customer' : 'Register Customer' }}</h3>
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                style="color: rgba(255,255,255,0.8);"
                @click="showForm = false"
              />
            </div>
            <div class="bg-white px-6 pt-6 pb-4">
              <DynamicForm
                :schema="customerFormSchema"
                :form="form"
                :isValid="isValid"
                :onSubmit="handleSubmit"
                :hideDefaultSubmit="true"
              />
              <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <v-btn
                  variant="outlined"
                  style="border-color: #d1d5db; color: #6b7280; text-transform: none;"
                  @click="showForm = false"
                >Cancel</v-btn>
                <v-btn
                  :disabled="!isValid"
                  style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;"
                  @click="handleSubmit"
                >{{ editId ? 'Update' : 'Submit' }}</v-btn>
              </div>
            </div>
          </v-card>
        </div>
      </template>
    </v-dialog>
    <v-dialog v-model="showOtpDialog" max-width="400">
      <template #default>
        <v-card class="rounded-xl overflow-hidden">
          <div class="bg-[#0d3d38] text-white px-6 py-4">
            <h3 class="text-lg font-semibold">Verify Mobile</h3>
          </div>
          <div class="bg-white px-6 pt-6 pb-4">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
              <v-text-field v-model="otpCode" placeholder="123456" />
            </div>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <v-btn variant="outlined" style="border-color: #d1d5db; color: #6b7280; text-transform: none;" @click="showOtpDialog = false">Cancel</v-btn>
              <v-btn style="background: #0f766e; color: #fff; text-transform: none; font-weight: 600;" @click="verifyOtpAndCreate">Verify</v-btn>
            </div>
          </div>
        </v-card>
      </template>
    </v-dialog>
    <ConfirmationDialog
      v-model="showDeleteConfirm"
      title="Delete Customer"
      @confirm="confirmDelete"
    >
      Are you sure you want to delete
      <strong>{{ toDelete?.name }}</strong>?
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { getAllCustomers, createCustomer, updateCustomer, deleteCustomer, sendOtp, verifyOtp } from '@/services/customerApiService'
import { defineAsyncComponent } from 'vue'

const BaseList = defineAsyncComponent(() => import('./BaseList.vue'))
const DynamicForm = defineAsyncComponent(() => import('./DynamicForm.vue'))
const ConfirmationDialog = defineAsyncComponent(() => import('./ConfirmationDialog.vue'))

const customerHeaders = [
  { title: 'Name',    key: 'name',         align: 'start' as const },
  { title: 'Mobile',  key: 'mobileNumber', align: 'start' as const },
  { title: 'City',    key: 'city',         align: 'start' as const },
  { title: 'State',   key: 'state',        align: 'start' as const },
  { title: 'Actions', key: 'actions',      align: 'end'   as const, sortable: false },
]

const customers = ref<any[]>([])

function toItem(c: any) {
  return {
    _id: c._id,
    firstName: c.firstName,
    lastName: c.lastName,
    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
    mobileNumber: c.mobileNumber,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2 ?? '',
    city: c.city,
    state: c.state,
    postalCode: c.postalCode,
  }
}

async function loadCustomers() {
  try {
    const data = await getAllCustomers()
    customers.value = data.map(toItem)
  } catch {
    showToast('Failed to load customers', 'error')
  }
}

onMounted(loadCustomers)

const showForm = ref(false)
const editId = ref<string | null>(null)

const customerFormSchema = {
  fields: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text' },
    { name: 'mobileNumber', label: 'Mobile Number', type: 'text', required: true, rules: [(v: string) => /^\d{10}$/.test(v) || 'Must be exactly 10 digits'] },
    { name: 'addressLine1', label: 'Address Line 1', type: 'text' },
    { name: 'addressLine2', label: 'Address Line 2', type: 'text' },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'state', label: 'State', type: 'text' },
    { name: 'postalCode', label: 'Postal Code', type: 'text' },
  ]
}

const { form, isValid } = useDynamicForm(customerFormSchema)
const { showToast } = useToast()

const showDeleteConfirm = ref(false)
const toDelete = ref<any | null>(null)

// OTP flow state
const showOtpDialog = ref(false)
const otpCode = ref('')
const pendingMobile = ref('')
const pendingPayload = ref<any | null>(null)

function resetForm() {
  editId.value = null
  customerFormSchema.fields.forEach(f => { form.value[f.name] = '' })
}

function onAddCustomer() {
  resetForm()
  showForm.value = true
}

function onEditCustomer(customer: any) {
  editId.value = customer._id
  customerFormSchema.fields.forEach(f => {
    form.value[f.name] = customer[f.name] ?? ''
  })
  showForm.value = true
}

async function handleSubmit() {
  try {
    const payload = { ...form.value } as any
    if (editId.value) {
      const saved = await updateCustomer(editId.value, payload)
      const idx = customers.value.findIndex(c => c._id === editId.value)
      if (idx !== -1) customers.value[idx] = toItem(saved)
      showToast('Customer updated successfully!', 'success')
    } else {
      // Start OTP flow: send OTP and create on verification
      await startOtpFlow(payload)
    }
    showForm.value = false
    resetForm()
  } catch {
    showToast('Failed to save customer. Please try again.', 'error')
  }
}

async function startOtpFlow(payload: any) {
  try {
    pendingPayload.value = payload
    pendingMobile.value = payload.mobileNumber
    await sendOtp(pendingMobile.value, payload)
    showOtpDialog.value = true
    showToast('OTP sent to mobile number. Please verify.', 'info')
  } catch (err) {
    showToast('Failed to send OTP. Please try again.', 'error')
  }
}

async function verifyOtpAndCreate() {
  try {
    if (!pendingMobile.value) return showToast('No pending mobile number', 'error')
    const saved = await verifyOtp(pendingMobile.value, otpCode.value)
    customers.value.push(toItem(saved))
    showToast('Customer registered successfully!', 'success')
    showOtpDialog.value = false
    showForm.value = false
    resetForm()
  } catch (err) {
    showToast((err as any)?.message || 'OTP verification failed', 'error')
  }
}

function onDeleteCustomer(customer: any) {
  toDelete.value = customer
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!toDelete.value) return
  try {
    await deleteCustomer(toDelete.value._id)
    customers.value = customers.value.filter(c => c._id !== toDelete.value!._id)
    showToast('Customer deleted successfully!', 'success')
  } catch {
    showToast('Failed to delete customer. Please try again.', 'error')
  } finally {
    toDelete.value = null
    showDeleteConfirm.value = false
  }
}
</script>
