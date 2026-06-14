import { ref, computed } from 'vue'
import { getBankReconciliationReport, type BankReconciliationRow } from '@/services/reportApiService'

export interface BankReconcileTableRow {
  expenseId: string
  date: string
  dateKey: string
  rowspanDate: number
  description: string
  amount: number
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10)
}

function transformRows(rawRows: BankReconciliationRow[]): BankReconcileTableRow[] {
  if (!rawRows.length) return []

  // Group by date key
  const dateGroups = new Map<string, BankReconciliationRow[]>()
  for (const row of rawRows) {
    const key = toDateKey(row.date)
    if (!dateGroups.has(key)) dateGroups.set(key, [])
    dateGroups.get(key)!.push(row)
  }

  const result: BankReconcileTableRow[] = []

  for (const [dateKey, dateRows] of dateGroups) {
    dateRows.forEach((raw, idx) => {
      result.push({
        expenseId: String(raw.expenseId),
        date: raw.date,
        dateKey,
        rowspanDate: idx === 0 ? dateRows.length : 0,
        description: raw.description,
        amount: raw.amount,
      })
    })
  }

  return result
}

export function useBankReconciliationReport() {
  const today = new Date().toISOString().substring(0, 10)
  const fromDate = ref(today)
  const toDate = ref(today)
  const rawRows = ref<BankReconciliationRow[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const tableRows = computed(() => transformRows(rawRows.value))
  const totalReconcileValue = computed(() => rawRows.value.reduce((sum, r) => sum + r.amount, 0))

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getBankReconciliationReport({
        fromDate: fromDate.value,
        toDate: toDate.value,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  return { fromDate, toDate, rawRows, tableRows, totalReconcileValue, loading, errorMsg, hasSearched, fetchReport }
}
