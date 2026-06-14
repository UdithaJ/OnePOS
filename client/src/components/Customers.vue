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
    />

    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <div class="customer-form-wrapper">
          <v-card class="rounded-xl overflow-hidden" style="border: none;">
            <div class="bg-[#0d3d38] text-white px-6 py-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold">Register Customer</h3>
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
                >Submit</v-btn>
              </div>
            </div>
          </v-card>
        </div>
      </template>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useToast, toastStyle } from '@/composables/useToast'
import { useDynamicForm } from '@/composables/useDynamicForm'
import { getAllCustomers, createCustomer } from '@/services/customerApiService'
import { defineAsyncComponent } from 'vue'

const BaseList = defineAsyncComponent(() => import('./BaseList.vue'))
const DynamicForm = defineAsyncComponent(() => import('./DynamicForm.vue'))

const customerHeaders = [
  { title: 'Name', key: 'name', align: 'start' },
  { title: 'Mobile', key: 'mobileNumber', align: 'start' },
  { title: 'City', key: 'city', align: 'start' },
  { title: 'State', key: 'state', align: 'start' },
]

const customers = ref([])

onMounted(async () => {
  try {
    const data = await getAllCustomers()
    customers.value = data.map((c: any) => ({
      name: c.firstName + ' ' + c.lastName,
      mobileNumber: c.mobileNumber,
      city: c.city,
      state: c.state,
    }))
  } catch (err) {
    // handle error
  }
})

const showForm = ref(false)

const customerFormSchema = {
  fields: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'mobileNumber', label: 'Mobile Number', type: 'text', required: true },
    { name: 'addressLine1', label: 'Address Line 1', type: 'text', required: true },
    { name: 'addressLine2', label: 'Address Line 2', type: 'text' },
    { name: 'city', label: 'City', type: 'text', required: true },
    { name: 'state', label: 'State', type: 'text', required: true },
    { name: 'postalCode', label: 'Postal Code', type: 'text', required: true },
  ]
}

const { form, isValid } = useDynamicForm(customerFormSchema)
const { showToast, toast } = useToast()

function onAddCustomer() {
  showForm.value = true
}

async function handleSubmit() {
  try {
    const payload = { ...form.value }
    const saved = await createCustomer(payload)
    customers.value.push({
      name: saved.firstName + ' ' + saved.lastName,
      mobileNumber: saved.mobileNumber,
      city: saved.city,
      state: saved.state,
    })
    showForm.value = false
    Object.keys(form.value).forEach(key => form.value[key] = '')
    showToast('Customer registered successfully!', 'success')
  } catch (err) {
    alert('Failed to register customer. Please try again.')
  }
}
</script>
