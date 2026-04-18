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

import { getAllOrders } from '@/services/orderApiService'

const orders = ref<any[]>([])

const showForm = ref(false)

import { onMounted } from 'vue'
import { getAllCustomers } from '@/services/customerApiService'
import { createOrder } from '@/services/orderApiService'

const customers = ref([])

const orderFormSchema = ref({
  fields: [
    { name: 'customer', label: 'Customer', type: 'autoselect', required: true, options: customers, allowFreeText: false },
    { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true },
    // dueAmount field removed
    // rackNumber field removed
  ]
})

import type { CustomerPayload } from '@/services/customerApiService'
onMounted(async () => {
  const [customerData, orderData] = await Promise.all([
    getAllCustomers(),
    getAllOrders()
  ])
  customers.value = (customerData || []).map((c: CustomerPayload & { _id: string }) => ({ label: c.firstName + ' ' + c.lastName, value: c._id }))
  orders.value = (orderData || []).map((order: any) => ({
    id: order._id,
    customer: customers.value.find(c => c.value === (order.customerID?._id || order.customerID))?.label || order.customerID,
    status: order.status,
    total: typeof order.totalAmount === 'number' ? `$${order.totalAmount.toFixed(2)}` : order.totalAmount
  }))
})

const { form, isValid } = useDynamicForm(orderFormSchema.value)

async function handleSubmit() {
  try {
    const payload = {
      customerID: form.value.customer, // This should be the customer ID
      weight: form.value.weight,
      deliveryDate: form.value.deliveryDate,
      totalAmount: form.value.totalAmount,
    };
    await createOrder(payload);
    showForm.value = false;
    // Optionally reset form fields here
  } catch (error) {
    // Handle error (show notification, etc.)
    console.error('Order creation failed', error);
  }
}
</script>
