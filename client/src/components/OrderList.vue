<template>
  <v-container>
    <h2 class="mb-4">Laundromat Orders</h2>
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
  </v-container>
</template>

<script lang="ts" setup>
const orders = [
  { id: '1001', customer: 'Alice', status: 'Completed', total: '$25.00' },
  { id: '1002', customer: 'Bob', status: 'In Progress', total: '$18.50' },
  { id: '1003', customer: 'Charlie', status: 'Pending', total: '$30.00' },
]
</script>
