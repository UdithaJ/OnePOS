import { ref, computed } from 'vue'
import { getPendingOrdersReport, type PendingOrdersRow } from '@/services/reportApiService'
import { localToday, localDayStartISO, localDayEndISO, toLocalDateKey } from '@/utils/reportDate'

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
  { label: 'Done', value: 'done' },
]

const STATUS_DISPLAY: Record<string, string> = {
  todo: 'To Do',
  done: 'Done',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

// Group by the LOCAL delivery day, matching the displayed Due Date.
const toDateKey = toLocalDateKey

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
  const today = localToday()
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
        fromDate: localDayStartISO(fromDate.value),
        toDate: localDayEndISO(toDate.value),
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
