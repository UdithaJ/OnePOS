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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <!-- Completed Orders -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
            <v-icon color="white" size="20">mdi-check-circle-outline</v-icon>
            <span class="text-white text-sm font-medium">Completed Orders</span>
          </div>
          <div class="px-5 py-5">
            <div class="text-3xl font-bold text-gray-900">{{ doneCount }}</div>
            <div class="text-sm text-gray-500 mt-1">Orders Done</div>
          </div>
        </div>

        <!-- Orders Today -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="px-5 py-3 flex items-center gap-2" style="background: #0f766e;">
            <v-icon color="white" size="20">mdi-cart</v-icon>
            <span class="text-white text-sm font-medium">Orders</span>
          </div>
          <div class="px-5 py-5">
            <div class="text-3xl font-bold text-gray-900">{{ ordersTodayCount }}</div>
            <div class="text-sm text-gray-500 mt-1">Orders Today</div>
          </div>
        </div>

        <!-- Pending Orders -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="px-5 py-3 flex items-center gap-2" style="background: #b45309;">
            <v-icon color="white" size="20">mdi-timer-sand</v-icon>
            <span class="text-white text-sm font-medium">Pending Orders</span>
          </div>
          <div class="px-5 py-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-3xl font-bold text-gray-900">{{ pendingCount }}</div>
              <div class="text-sm text-gray-500 mt-1">Orders Pending</div>
            </div>
            <div class="w-px h-10 bg-gray-200"></div>
            <div>
              <div class="text-3xl font-bold text-gray-900">{{ formatWeight(pendingWeightKg) }} <span class="text-lg font-medium text-gray-500">kg</span></div>
              <div class="text-sm text-gray-500 mt-1">Pending</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CashBox + Bank Transfers + Quick Actions -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <CashBox @session-changed="bankTransfersCard?.fetchBankTransfers()" />
        <BankTransfersCard ref="bankTransfersCard" />
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
              @click="router.push({ name: 'OrderList', query: { new: '1' } })"
            >
              <v-icon size="24" class="mb-1">mdi-clipboard-plus-outline</v-icon>
              New Order
            </v-btn>
            <!-- Registering a customer is an admin action, and /customers is
                 admin-only, so a cashier gets the button disabled rather than a
                 shortcut that bounces them back here. -->
            <v-btn
              block
              height="80"
              stacked
              variant="outlined"
              :disabled="!isAdmin"
              style="border-color: #0f766e; color: #0f766e; text-transform: none; font-weight: 600;"
              @click="router.push({ name: 'Customers', query: { new: '1' } })"
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
            <v-btn-toggle
              v-model="monthRange"
              mandatory
              density="compact"
              variant="text"
              class="ml-auto month-range-toggle"
            >
              <v-btn v-for="range in MONTH_RANGES" :key="range" :value="range" size="small">
                {{ range }}M
              </v-btn>
            </v-btn-toggle>
          </div>
          <div class="px-5 py-4" style="height: 260px; position: relative;">
            <Line v-if="lineChartData" :data="lineChartData" :options="chartOptions" />
            <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
              {{ monthlyError ? 'Could not load monthly orders' : 'Loading…' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
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
import BankTransfersCard from './BankTransfersCard.vue'

const bankTransfersCard = ref<InstanceType<typeof BankTransfersCard> | null>(null)
import DeliveryPending from './DeliveryPending.vue'
import { useAuth } from '@/composables/useAuth'
import { getDashboardSummary, getMonthlyOrderCount, type MonthRange } from '@/services/dashboardApiService'
import { formatWeight } from '@/utils/number'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const router = useRouter()
const { getUser } = useAuth()

const isAdmin = computed(() => getUser()?.userRole === 'admin')

const ordersTodayCount = ref(0)
const doneCount = ref(0)
const pendingCount = ref(0)
const pendingWeightKg = ref(0)
const barChartData = ref<any>(null)
const lineChartData = ref<any>(null)

const MONTH_RANGES: MonthRange[] = [3, 6, 12]
const monthRange = ref<MonthRange>(12)
const monthlyError = ref(false)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
    x: { grid: { display: false }, ticks: { color: '#6b7280' } },
  },
}

// 'YYYY-MM' -> 'Sep 2026'
function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return `${new Date(year, m - 1, 1).toLocaleString('default', { month: 'short' })} ${year}`
}

// Every month in the range is plotted, zeros included, so a quiet month shows
// as a dip rather than being skipped.
async function loadMonthlyOrders() {
  const months = monthRange.value
  monthlyError.value = false
  try {
    const byMonth = await getMonthlyOrderCount(months)
    // Ignore a slow response for a range the user has already switched away from
    if (months !== monthRange.value) return
    lineChartData.value = {
      labels: byMonth.map(r => monthLabel(r.month)),
      datasets: [{
        label: 'Orders',
        data: byMonth.map(r => r.count),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15,118,110,0.1)',
        // monotone keeps the curve from dipping below zero around empty months
        cubicInterpolationMode: 'monotone',
        fill: true,
        pointBackgroundColor: '#0f766e',
        pointRadius: 4,
      }],
    }
  } catch {
    if (months !== monthRange.value) return
    lineChartData.value = null
    monthlyError.value = true
  }
}

watch(monthRange, loadMonthlyOrders)

onMounted(async () => {
  loadMonthlyOrders()

  const summary = await getDashboardSummary()

  doneCount.value = summary.doneCount
  ordersTodayCount.value = summary.ordersTodayCount
  pendingCount.value = summary.pendingCount
  pendingWeightKg.value = summary.pendingWeightKg

  const byCategory = summary.todayWeightByCategory
  if (byCategory.length) {
    const tealPalette = ['#b45309', '#292929', '#0d3d38', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4']
    barChartData.value = {
      labels: byCategory.map(r => r.category),
      datasets: [{
        label: 'kg',
        data: byCategory.map(r => r.weightKg),
        backgroundColor: byCategory.map((_, i) => tealPalette[i % tealPalette.length]),
        borderRadius: 6,
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

/* 3M / 6M / 12M toggle on the dark chart header */
.month-range-toggle {
  height: 24px;
}
.month-range-toggle :deep(.v-btn) {
  color: rgba(255, 255, 255, 0.7);
  text-transform: none;
  min-width: 36px;
  font-size: 0.75rem;
}
.month-range-toggle :deep(.v-btn--active) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
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
