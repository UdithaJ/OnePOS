<template>
  <div class="dp-panel">
    <!-- Header -->
    <div class="dp-panel-header">
      <div class="dp-panel-title-row">
        <v-icon size="18" color="white" class="mr-2">mdi-truck-delivery-outline</v-icon>
        <span class="dp-panel-title">Delivery Pending</span>
        <v-chip
          v-if="!loading"
          size="x-small"
          color="white"
          variant="tonal"
          class="ml-auto"
          style="opacity: 0.85;"
        >{{ pendingOrders.length }}</v-chip>
      </div>
    </div>

    <!-- Body -->
    <div class="dp-panel-body">
      <!-- Loading -->
      <div v-if="loading" class="dp-skeleton-wrap">
        <v-skeleton-loader type="card" :loading="true" class="mb-3" style="border-radius:12px;" />
        <v-skeleton-loader type="card" :loading="true" class="mb-3" style="border-radius:12px;" />
        <v-skeleton-loader type="card" :loading="true" style="border-radius:12px;" />
      </div>

      <!-- Error -->
      <v-alert v-else-if="errorMsg" type="error" variant="tonal" density="compact" class="ma-3">
        {{ errorMsg }}
      </v-alert>

      <!-- Empty -->
      <div v-else-if="pendingOrders.length === 0" class="dp-empty">
        <v-icon size="44" color="teal-darken-1" class="mb-2">mdi-truck-check-outline</v-icon>
        <p class="dp-empty-text">No completed orders pending delivery</p>
      </div>

      <!-- Tiles -->
      <div v-else class="dp-tile-list">
        <div
          v-for="order in pendingOrders"
          :key="order.id"
          class="dp-tile"
          :class="{ 'dp-tile--removing': removingIds.has(order.id) }"
        >
          <!-- Top row: date + checkbox -->
          <div class="dp-tile-top">
            <span class="dp-tile-date">
              {{ formatDate(order.deliveryDate) }}
            </span>
            <v-checkbox
              v-model="order.checked"
              hide-details
              color="teal-darken-2"
              density="compact"
              class="dp-tile-checkbox"
              :disabled="removingIds.has(order.id)"
              @update:model-value="(val) => onMarkDelivered(order, val)"
            />
          </div>

          <!-- Order number -->
          <div class="dp-tile-order-no">Order #{{ order.orderNo }}</div>

          <!-- Customer name -->
          <div class="dp-tile-customer">{{ order.customerName }}</div>

          <!-- Mark as delivered label -->
          <div class="dp-tile-label-row">
            <span
              class="dp-tile-action-label"
              :class="{ 'dp-tile-action-label--removing': removingIds.has(order.id) }"
            >
              {{ removingIds.has(order.id) ? 'Marked as delivered...' : 'Mark as delivered' }}
            </span>
          </div>

          <!-- Countdown bar shown during 5-second window -->
          <div v-if="removingIds.has(order.id)" class="dp-countdown-bar" />
        </div>
      </div>
    </div>

    <v-snackbar
      v-model="snackbar.show"
      color="error"
      location="bottom right"
      :timeout="3500"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getAllOrders, updateOrder } from '@/services/orderApiService'
import { getAllCustomers } from '@/services/customerApiService'

interface PendingOrder {
  id: string
  orderNo: number | string
  customerName: string
  deliveryDate: string
  checked: boolean
}

const REMOVE_DELAY_MS = 5000

const loading = ref(false)
const errorMsg = ref('')
const pendingOrders = ref<PendingOrder[]>([])
const removingIds = ref<Set<string>>(new Set())
const snackbar = ref({ show: false, message: '' })
const timerMap = new Map<string, ReturnType<typeof setTimeout>>()

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [orderData, customerData] = await Promise.all([getAllOrders(), getAllCustomers()])
    const customerMap = new Map(
      (customerData || []).map((c: any) => [
        String(c._id),
        `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      ])
    )
    pendingOrders.value = (orderData || [])
      .filter((o: any) => o.status === 'completed')
      .map((o: any) => ({
        id: String(o._id),
        orderNo: o.orderNo || o._id,
        customerName:
          customerMap.get(String(o.customerID?._id ?? o.customerID)) ||
          String(o.customerID ?? '—'),
        deliveryDate: o.deliveryDate,
        checked: false,
      }))
  } catch {
    errorMsg.value = 'Failed to load orders.'
  } finally {
    loading.value = false
  }
}

function onMarkDelivered(order: PendingOrder, checked: boolean | null) {
  if (checked) {
    // Enter "removing" state — visual countdown starts
    removingIds.value = new Set([...removingIds.value, order.id])

    const timer = setTimeout(async () => {
      const index = pendingOrders.value.findIndex(o => o.id === order.id)
      if (index === -1) return
      const [removed] = pendingOrders.value.splice(index, 1)
      removingIds.value = new Set([...removingIds.value].filter(id => id !== order.id))
      timerMap.delete(order.id)
      try {
        await updateOrder(order.id, { status: 'delivered' } as any)
      } catch {
        pendingOrders.value.splice(index, 0, { ...removed, checked: false })
        snackbar.value = { show: true, message: 'Failed to update order. Please try again.' }
      }
    }, REMOVE_DELAY_MS)

    timerMap.set(order.id, timer)
  } else {
    // User unchecked — cancel pending removal
    const timer = timerMap.get(order.id)
    if (timer) clearTimeout(timer)
    timerMap.delete(order.id)
    removingIds.value = new Set([...removingIds.value].filter(id => id !== order.id))
  }
}

onMounted(loadData)
onUnmounted(() => { timerMap.forEach(t => clearTimeout(t)) })
</script>

<style scoped lang="scss">
.dp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f3f4f6;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* ── Header ── */
.dp-panel-header {
  background: #0d3d38;
  padding: 12px 16px;
  flex-shrink: 0;
}

.dp-panel-title-row {
  display: flex;
  align-items: center;
}

.dp-panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
}

/* ── Body ── */
.dp-panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: #0f766e; border-radius: 2px; }
}

.dp-skeleton-wrap {
  padding: 12px;
}

.dp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
}

.dp-empty-text {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0;
}

/* ── Tile list ── */
.dp-tile-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 12px;
  gap: 12px;
}

/* ── Individual tile ── */
.dp-tile {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px 16px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  border: 1px solid #f0f0f0;
  transition: background 0.3s ease, box-shadow 0.2s ease;
  overflow: hidden;
  position: relative;

  &:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10);
  }

  &.dp-tile--removing {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
}

/* ── Tile top row: date + checkbox ── */
.dp-tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.dp-tile-date {
  font-size: 0.72rem;
  color: #9ca3af;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.dp-tile-checkbox {
  flex-shrink: 0;
  margin: 0;
  :deep(.v-selection-control) {
    min-height: unset;
  }
}

/* ── Tile body ── */
.dp-tile-order-no {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 3px;
  line-height: 1.3;
}

.dp-tile-customer {
  font-size: 0.8rem;
  color: #6b7280;
  line-height: 1.4;
  margin-bottom: 8px;
}

/* ── Label row ── */
.dp-tile-label-row {
  display: flex;
  align-items: center;
}

.dp-tile-action-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: #9ca3af;

  &.dp-tile-action-label--removing {
    color: #059669;
  }
}

/* ── Countdown progress bar ── */
.dp-countdown-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #0f766e;
  border-radius: 0 0 0 12px;
  animation: dp-countdown 5s linear forwards;
}

@keyframes dp-countdown {
  from { width: 100%; }
  to   { width: 0%;   }
}
</style>
