<template>
  <v-container>
    <h2 class="mb-4">Laundromat Orders</h2>
    <v-btn color="primary" class="mb-4" @click="showForm = true">Place Order</v-btn>
    <v-table>
      <thead>
        <tr>
          <th>Order #</th>
          <th>Customer</th>
          <th>Status</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" :key="order.id">
          <td>{{ order.id }}</td>
          <td>{{ order.customer }}</td>
          <td>{{ order.status }}</td>
          <td>{{ order.total }}</td>
        </tr>
      </tbody>
    </v-table>

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
import DynamicForm from '@/components/DynamicForm.vue'
import { useDynamicForm } from '@/composables/useDynamicForm'

const orders = [
  { id: '1001', customer: 'Alice', status: 'Completed', total: '$25.00' },
  { id: '1002', customer: 'Bob', status: 'In Progress', total: '$18.50' },
  { id: '1003', customer: 'Charlie', status: 'Pending', total: '$30.00' },
]

const showForm = ref(false)

const orderFormSchema = {
  fields: [
    { name: 'customerID', label: 'Customer ID', type: 'text', required: true },
    { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'text', required: true },
    { name: 'paymentStatus', label: 'Payment Status', type: 'select', required: true, options: [
      { label: 'Unpaid', value: 'unpaid' },
      { label: 'Partial', value: 'partial' },
      { label: 'Paid', value: 'paid' },
    ] },
    { name: 'createdUser', label: 'Created User', type: 'text', required: true },
    { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true },
    { name: 'dueAmount', label: 'Due Amount', type: 'number', required: true },
    { name: 'rackNumber', label: 'Rack Number', type: 'text' },
  ]
}

const { form, isValid } = useDynamicForm(orderFormSchema)

function handleSubmit() {
  // Here you would handle the form submission, e.g., add to orders
  showForm.value = false
  // Optionally reset form fields here
}
</script>
