import { ref, computed } from 'vue'
import { getPendingOrdersReport, type PendingOrdersRow } from '@/services/reportApiService'

export interface PendingTableRow {
  orderId: string
  orderNo: number
  deliveryDate: string
  status: string
  statusDisplay: string
  rackNumber: string
  customerName: string
  mobileNumber: string
  rowspanOrder: number

  dateKey: string
  rowspanDate: number

  categoryName: string
  weight: number
}

export const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'To Do', value: 'todo' },
  { label: 'Completed', value: 'completed' },
]

const STATUS_DISPLAY: Record<string, string> = {
  todo: 'To Do',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10)
}

function transformRows(rawRows: PendingOrdersRow[]): PendingTableRow[] {
  if (!rawRows.length) return []

  // Group by delivery date key
  const dateGroups = new Map<string, PendingOrdersRow[]>()
  for (const row of rawRows) {
    const key = toDateKey(row.deliveryDate)
    if (!dateGroups.has(key)) dateGroups.set(key, [])
    dateGroups.get(key)!.push(row)
  }

  const result: PendingTableRow[] = []

  for (const [dateKey, dateRows] of dateGroups) {
    const dateTotalRowspan = dateRows.length

    // Group by orderId within this date
    const orderGroups = new Map<string, PendingOrdersRow[]>()
    for (const row of dateRows) {
      const oid = String(row.orderId)
      if (!orderGroups.has(oid)) orderGroups.set(oid, [])
      orderGroups.get(oid)!.push(row)
    }

    let isFirstRowOfDate = true

    for (const [, orderRows] of orderGroups) {
      const rowspanOrder = orderRows.length

      orderRows.forEach((raw, idx) => {
        result.push({
          orderId: String(raw.orderId),
          orderNo: raw.orderNo,
          deliveryDate: raw.deliveryDate,
          status: raw.status,
          statusDisplay: STATUS_DISPLAY[raw.status] ?? raw.status,
          rackNumber: raw.rackNumber ?? '-',
          customerName: raw.customerName,
          mobileNumber: raw.mobileNumber,
          rowspanOrder: idx === 0 ? rowspanOrder : 0,

          dateKey,
          rowspanDate: isFirstRowOfDate ? dateTotalRowspan : 0,

          categoryName: raw.categoryName,
          weight: raw.weight,
        })
        if (isFirstRowOfDate) isFirstRowOfDate = false
      })
    }
  }

  return result
}

export function usePendingOrdersReport() {
  const today = new Date().toISOString().substring(0, 10)
  const fromDate = ref(today)
  const toDate = ref(today)
  const statusFilter = ref('all')
  const rawRows = ref<PendingOrdersRow[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const tableRows = computed(() => transformRows(rawRows.value))
  const grandTotalWeight = computed(() => rawRows.value.reduce((sum, r) => sum + r.weight, 0))

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getPendingOrdersReport({
        fromDate: fromDate.value,
        toDate: toDate.value,
        status: statusFilter.value,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  return { fromDate, toDate, statusFilter, rawRows, tableRows, grandTotalWeight, loading, errorMsg, hasSearched, fetchReport }
}
