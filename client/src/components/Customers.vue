<template>
  <v-container>
    <h2 class="mb-4">Customers</h2>
    <BaseList
      title="Customer List"
      :headers="customerHeaders"
      :items="customers"
      @add="onAddCustomer"
    />
    <v-dialog v-model="showForm" max-width="600">
      <template #default>
        <v-card class="pa-6">
          <h3 class="mb-4">Register Customer</h3>
          <DynamicForm
            :schema="customerFormSchema"
            :form="form"
            :isValid="isValid"
            :onSubmit="handleSubmit"
          />
        </v-card>
      </template>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>

import { onMounted, ref } from 'vue'
import BaseList from '@/components/BaseList.vue'
import { createCustomer, CustomerPayload, getAllCustomers } from '@/services/customerApiService'
import DynamicForm from '@/components/DynamicForm.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'

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
    // Map backend data to table format
    customers.value = data.map((c: any) => ({
      name: c.firstName + ' ' + c.lastName,
      mobileNumber: c.mobileNumber,
      city: c.city,
      state: c.state,
    }))
  } catch (err) {
    // Optionally handle error
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

function onAddCustomer() {
  showForm.value = true
}

async function handleSubmit() {
  try {
    // Call backend API to register customer
    const payload = { ...form.value }
    const saved = await createCustomer(payload)
    // Add to local list (merge first/last name for display)
    customers.value.push({
      name: saved.firstName + ' ' + saved.lastName,
      mobileNumber: saved.mobileNumber,
      city: saved.city,
      state: saved.state,
      // Optionally add more fields as needed
    })
    showForm.value = false
    // Reset form fields
    Object.keys(form.value).forEach(key => form.value[key] = '')
  } catch (err) {
    alert('Failed to register customer. Please try again.')
  }
}
</script>