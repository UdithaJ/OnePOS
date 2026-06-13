<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
      <span class="w-1 h-7 bg-[#0f766e] rounded-full inline-block"></span>
      POS Dashboard
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <!-- Total Sales -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-[#0d3d38] px-5 py-3 flex items-center gap-2">
          <v-icon color="white" size="20">mdi-currency-usd</v-icon>
          <span class="text-white text-sm font-medium">Total Sales</span>
        </div>
        <div class="px-5 py-5">
          <div class="text-3xl font-bold text-gray-900">$2,350.00</div>
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

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CashBox />

      <!-- Quick Actions -->
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
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CashBox from './CashBox.vue'
import { getAllOrders } from '@/services/orderApiService'

const router = useRouter()

const pendingCount = ref(0)
const pendingWeightKg = ref(0)

onMounted(async () => {
  const orders = await getAllOrders()
  const pending = (orders || []).filter((o: any) => o.status === 'todo' || o.status === 'in_progress')
  pendingCount.value = pending.length
  pendingWeightKg.value = pending.reduce((sum: number, o: any) => {
    const w = (o.suborders || []).reduce((s: number, sub: any) => s + (Number(sub.weight) || 0), 0)
    return sum + w
  }, 0)
})
</script>
