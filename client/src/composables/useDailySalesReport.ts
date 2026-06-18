import { ref, computed } from 'vue'
import { getDailySalesReport, type DailySalesRow } from '@/services/reportApiService'

export interface TableRow {
  orderId: string
  orderNo: number
  createdDate: string
  deliveryDate: string
  status: string
  statusDisplay: string
  rackNumber: string
  customerName: string
  rowspanOrder: number

  dateKey: string
  dateTotalAmount: number
  rowspanDate: number

  categoryName: string
  weight: number
  amount: number
}

const STATUS_DISPLAY: Record<string, string> = {
  todo: 'To Do',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10)
}

function transformRows(rawRows: DailySalesRow[]): TableRow[] {
  if (!rawRows.length) return []

  // Group by date key
  const dateGroups = new Map<string, DailySalesRow[]>()
  for (const row of rawRows) {
    const key = toDateKey(row.createdDate)
    if (!dateGroups.has(key)) dateGroups.set(key, [])
    dateGroups.get(key)!.push(row)
  }

  const result: TableRow[] = []

  for (const [dateKey, dateRows] of dateGroups) {
    const dateTotalAmount = dateRows.reduce((sum, r) => sum + r.amount, 0)
    const dateTotalRowspan = dateRows.length

    // Group by orderId within this date
    const orderGroups = new Map<string, DailySalesRow[]>()
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
          createdDate: raw.createdDate,
          deliveryDate: raw.deliveryDate,
          status: raw.status,
          statusDisplay: STATUS_DISPLAY[raw.status] ?? raw.status,
          rackNumber: raw.rackNumber ?? '-',
          customerName: raw.customerName,
          rowspanOrder: idx === 0 ? rowspanOrder : 0,

          dateKey,
          dateTotalAmount,
          rowspanDate: isFirstRowOfDate ? dateTotalRowspan : 0,

          categoryName: raw.categoryName,
          weight: raw.weight,
          amount: raw.amount,
        })
        if (isFirstRowOfDate) isFirstRowOfDate = false
      })
    }
  }

  return result
}

export function useDailySalesReport() {
  const today = new Date().toISOString().substring(0, 10)
  const fromDate = ref(today)
  const toDate = ref(today)
  const rawRows = ref<DailySalesRow[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const tableRows = computed(() => transformRows(rawRows.value))
  const grandTotal = computed(() => rawRows.value.reduce((sum, r) => sum + r.amount, 0))

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getDailySalesReport({
        fromDate: fromDate.value,
        toDate: toDate.value,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  return { fromDate, toDate, rawRows, tableRows, grandTotal, loading, errorMsg, hasSearched, fetchReport }
}
