import axios from 'axios'
import { localToday, localDayStartISO, localDayEndISO } from '@/utils/reportDate'

export interface DashboardSummary {
  doneCount: number
  ordersTodayCount: number
  pendingCount: number
  pendingWeightKg: number
  todayWeightByCategory: { category: string; weightKg: number }[]
}

export type MonthRange = 3 | 6 | 12

// One entry per month in the range, oldest first, including months with no
// orders. month is 'YYYY-MM' in the browser's timezone.
export interface MonthlyOrderCount {
  month: string
  count: number
}

export interface DeliveryPendingOrder {
  id: string
  orderNo: number
  customerName: string
  deliveryDate: string
}

// The server does the counting; "today" is the browser's local day, sent as
// absolute instants the same way the report screens do.
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const today = localToday()
  const response = await axios.get(`${baseUrl}/api/dashboard/summary`, {
    params: {
      dayStart: localDayStartISO(today),
      dayEnd: localDayEndISO(today),
    },
  })
  return response.data
}

// Order count per month for the current month and the ones before it.
// Cancelled orders are not counted.
export async function getMonthlyOrderCount(months: MonthRange): Promise<MonthlyOrderCount[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/dashboard/monthly-orders`, {
    params: { months, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })
  return response.data
}

export async function getDeliveryPending(): Promise<DeliveryPendingOrder[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/dashboard/delivery-pending`)
  return response.data
}
