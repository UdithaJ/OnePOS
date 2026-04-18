<template>
  <v-container>
    <h2 class="mb-4">Laundromat Orders</h2>
    <BaseList
      title="Orders"
      :headers="orderHeaders"
      :items="orders"
      @add="showForm = true"
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
        </v-card>
      </template>
    </v-dialog>
  </v-container>
 </template>

<script lang="ts" setup>

import { ref } from 'vue'
import BaseList from '@/components/BaseList.vue'
import DynamicForm from '@/components/DynamicForm.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'


const orderHeaders = [
  { title: 'Order #', key: 'id', align: 'start' },
  { title: 'Customer', key: 'customer', align: 'start' },
  { title: 'Status', key: 'status', align: 'start' },
  { title: 'Total', key: 'total', align: 'end' },
]

const orders = [
  { id: '1001', customer: 'Alice', status: 'Completed', total: '$25.00' },
  { id: '1002', customer: 'Bob', status: 'In Progress', total: '$18.50' },
  { id: '1003', customer: 'Charlie', status: 'Pending', total: '$30.00' },
]

const showForm = ref(false)

import { onMounted } from 'vue'
import { getAllCustomers } from '@/services/customerApiService'

const customers = ref([])

const orderFormSchema = ref({
  fields: [
    { name: 'customer', label: 'Customer', type: 'autoselect', required: true, options: customers },
    { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'text', required: true },
    // paymentStatus and createdUser fields removed
    { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true },
    // dueAmount field removed
    { name: 'rackNumber', label: 'Rack Number', type: 'text' },
  ]
})

import type { CustomerPayload } from '@/services/customerApiService'
onMounted(async () => {
  const data = await getAllCustomers()
  customers.value = (data || []).map((c: CustomerPayload & { id: string }) => ({ label: c.firstName + ' ' + c.lastName, value: c.id }))
})

const { form, isValid } = useDynamicForm(orderFormSchema.value)

function handleSubmit() {
  // Here you would handle the form submission, e.g., add to orders
  showForm.value = false
  // Optionally reset form fields here
}
</script>
