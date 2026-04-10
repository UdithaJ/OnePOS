<template>
  <div class="dashboard">
    <h1>POS Dashboard</h1>
    <div class="dashboard-cards">
      <div class="dashboard-card">
        <h2>Total Sales</h2>
        <p>{{ totalSales }}</p>
      </div>
      <div class="dashboard-card">
        <h2>Orders Today</h2>
        <p>{{ ordersToday }}</p>
      </div>
      <div class="dashboard-card">
        <h2>Active Cash Boxes</h2>
        <p>{{ activeCashBoxes }}</p>
      </div>
      <div class="dashboard-card">
        <h2>Top Product</h2>
        <p>{{ topProduct }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const totalSales = ref('$2,350.00')
const ordersToday = ref(42)
const activeCashBoxes = ref(3)
const topProduct = ref('Cappuccino')
</script>

<style scoped>
.dashboard {
  padding: 2rem;
}
.dashboard-cards {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.dashboard-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  padding: 1.5rem;
  min-width: 200px;
  flex: 1;
}
.dashboard-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}
.dashboard-card p {
  font-size: 2rem;
  margin: 0;
  font-weight: bold;
}
</style>
