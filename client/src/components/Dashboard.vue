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
        <div class="px-5 py-5">
          <div class="text-3xl font-bold text-gray-900">5</div>
          <div class="text-sm text-gray-500 mt-1">Awaiting processing</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CashBox />

      <!-- Quick Actions -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-[#0d3d38] px-5 py-3">
          <span class="text-white text-sm font-medium">Quick Actions</span>
        </div>
        <div class="px-5 py-5 flex flex-col gap-3">
          <v-btn
            block
            style="background: #0f766e; color: #ffffff; text-transform: none; font-weight: 600;"
          >New Sale</v-btn>
          <v-btn
            block
            variant="outlined"
            style="border-color: #0f766e; color: #0f766e; text-transform: none; font-weight: 600;"
          >View Reports</v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import CashBox from './CashBox.vue'
</script>
