<template>
  <div class="dashboard-root">
    <!-- Left: Delivery Pending panel -->
    <div class="dashboard-left">
      <DeliveryPending />
    </div>

    <!-- Right: main dashboard content -->
    <div class="dashboard-right">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
        <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
        POS Dashboard
      </h2>

      <!-- Stat cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <!-- Total Sales -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
            <v-icon color="white" size="20">mdi-currency-inr</v-icon>
            <span class="text-white text-sm font-medium">Total Sales</span>
          </div>
          <div class="px-5 py-5">
            <div class="text-3xl font-bold text-gray-900">Rs 2,350.00</div>
            <div class="text-sm text-gray-500 mt-1">This month</div>
          </div>
        </div>

        <!-- Orders Today -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="px-5 py-3 flex items-center gap-2" style="background: #0f766e;">
            <v-icon color="white" size="20">mdi-cart</v-icon>
            <span class="text-white text-sm font-medium">Orders Today</span>
          </div>
          <div class="px-5 py-5">
            <div class="text-3xl font-bold text-gray-900">27</div>
            <div class="text-sm text-gray-500 mt-1">Since midnight</div>
          </div>
        </div>

        <!-- Pending Orders -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="px-5 py-3 flex items-center gap-2" style="background: #b45309;">
            <v-icon color="white" size="20">mdi-timer-sand</v-icon>
            <span class="text-white text-sm font-medium">Pending Orders</span>
          </div>
          <div class="px-5 py-5 flex items-center justify-between">
            <div>
              <div class="text-3xl font-bold text-gray-900">{{ pendingCount }}</div>
              <div class="text-sm text-gray-500 mt-1">Awaiting processing</div>
            </div>
            <div class="w-px h-10 bg-gray-200"></div>
            <div>
              <div class="text-3xl font-bold text-gray-900">{{ pendingWeightKg }} <span class="text-lg font-medium text-gray-500">kg</span></div>
              <div class="text-sm text-gray-500 mt-1">Total weight</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CashBox + Quick Actions -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <CashBox />
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="bg-[#0d3d38] px-5 py-3">
            <span class="text-white text-sm font-medium">Quick Access</span>
          </div>
          <div class="px-5 py-5 grid grid-cols-2 gap-3">
            <v-btn
              block
              height="80"
              stacked
              style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
              @click="router.push('/order-list')"
            >
              <v-icon size="24" class="mb-1">mdi-clipboard-plus-outline</v-icon>
              New Order
            </v-btn>
            <v-btn
              block
              height="80"
              stacked
              variant="outlined"
              style="border-color: #0f766e; color: #0f766e; text-transform: none; font-weight: 600;"
              @click="router.push('/customers')"
            >
              <v-icon size="24" class="mb-1">mdi-account-plus-outline</v-icon>
              New Customer
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
            <v-icon color="white" size="20">mdi-chart-bar</v-icon>
            <span class="text-white text-sm font-medium">Today's Weight by Category (kg)</span>
          </div>
          <div class="px-5 py-4" style="height: 260px; position: relative;">
            <Bar v-if="barChartData" :data="barChartData" :options="chartOptions" />
            <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">No orders today</div>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
            <v-icon color="white" size="20">mdi-chart-line</v-icon>
            <span class="text-white text-sm font-medium">Monthly Order Count</span>
          </div>
          <div class="px-5 py-4" style="height: 260px; position: relative;">
            <Line v-if="lineChartData" :data="lineChartData" :options="chartOptions" />
            <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import CashBox from './CashBox.vue'
import DeliveryPending from './DeliveryPending.vue'
import { getAllOrders } from '@/services/orderApiService'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const router = useRouter()

const pendingCount = ref(0)
const pendingWeightKg = ref(0)
const barChartData = ref<any>(null)
const lineChartData = ref<any>(null)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
    x: { grid: { display: false }, ticks: { color: '#6b7280' } },
  },
}

onMounted(async () => {
  const orders = await getAllOrders()
  const all = orders || []

  const pending = all.filter((o: any) => o.status === 'todo')
  pendingCount.value = pending.length
  pendingWeightKg.value = pending.reduce((sum: number, o: any) => {
    return sum + (o.suborders || []).reduce((s: number, sub: any) => s + (Number(sub.weight) || 0), 0)
  }, 0)

  const today = new Date().toDateString()
  const kgByCategory: Record<string, number> = {}
  for (const order of all) {
    if (new Date(order.createdDate).toDateString() !== today) continue
    for (const sub of order.suborders || []) {
      const name = sub.category?.name || 'Unknown'
      kgByCategory[name] = (kgByCategory[name] || 0) + (Number(sub.weight) || 0)
    }
  }
  if (Object.keys(kgByCategory).length) {
    const tealPalette = ['#b45309', '#292929', '#0d3d38', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4']
    const labels = Object.keys(kgByCategory)
    barChartData.value = {
      labels,
      datasets: [{
        label: 'kg',
        data: Object.values(kgByCategory),
        backgroundColor: labels.map((_, i) => tealPalette[i % tealPalette.length]),
        borderRadius: 6,
      }],
    }
  }

  const countByMonth: Record<string, number> = {}
  for (const order of all) {
    const d = new Date(order.createdDate)
    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
    countByMonth[key] = (countByMonth[key] || 0) + 1
  }
  const sortedMonths = Object.keys(countByMonth).sort(
    (a, b) => (new Date(a) > new Date(b) ? 1 : -1)
  )
  if (sortedMonths.length) {
    lineChartData.value = {
      labels: sortedMonths,
      datasets: [{
        label: 'Orders',
        data: sortedMonths.map(m => countByMonth[m]),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15,118,110,0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#0f766e',
        pointRadius: 4,
      }],
    }
  }
})
</script>

<style scoped>
.dashboard-root {
  display: flex;
  gap: 20px;
  padding: 24px;
  height: calc(100vh - 64px);
  box-sizing: border-box;
  overflow: hidden;
}

.dashboard-left {
  width: 337px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.dashboard-right::-webkit-scrollbar {
  width: 4px;
}
.dashboard-right::-webkit-scrollbar-track {
  background: transparent;
}
.dashboard-right::-webkit-scrollbar-thumb {
  background: #0f766e;
  border-radius: 2px;
}
</style>
