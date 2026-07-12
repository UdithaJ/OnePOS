import { ref, computed, onMounted } from 'vue'
import { getExpensesReport, getExpenseCategories, type ExpensesReportRow, type ExpenseCategory } from '@/services/reportApiService'
import { localToday, localDayStartISO, localDayEndISO, toLocalDateKey } from '@/utils/reportDate'

export interface ExpensesTableRow {
  expenseId: string
  date: string
  dateKey: string
  rowspanDate: number
  description: string
  amount: number
}

// Group by the LOCAL expense day, matching the displayed Date.
const toDateKey = toLocalDateKey

function transformRows(rawRows: ExpensesReportRow[]): ExpensesTableRow[] {
  if (!rawRows.length) return []

  const dateGroups = new Map<string, ExpensesReportRow[]>()
  for (const row of rawRows) {
    const key = toDateKey(row.date)
    if (!dateGroups.has(key)) dateGroups.set(key, [])
    dateGroups.get(key)!.push(row)
  }

  const result: ExpensesTableRow[] = []

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

export function useExpensesReport() {
  const today = localToday()
  const fromDate = ref(today)
  const toDate = ref(today)
  const expenseTypeId = ref('all')
  const rawRows = ref<ExpensesReportRow[]>([])
  const categories = ref<ExpenseCategory[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const categoryOptions = computed(() => {
    const filtered = categories.value.filter(
      (c) => !/^bank deposite$/i.test(c.displayName)
    )
    return [
      { label: 'All', value: 'all' },
      ...filtered.map((c) => ({ label: c.displayName, value: c._id })),
    ]
  })

  const tableRows = computed(() => transformRows(rawRows.value))
  const totalExpenses = computed(() => rawRows.value.reduce((sum, r) => sum + r.amount, 0))

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getExpensesReport({
        fromDate: localDayStartISO(fromDate.value),
        toDate: localDayEndISO(toDate.value),
        expenseTypeId: expenseTypeId.value,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    try {
      categories.value = await getExpenseCategories()
    } catch {
      // dropdown stays empty; report can still be generated
    }
  })

  return { fromDate, toDate, expenseTypeId, categoryOptions, rawRows, tableRows, totalExpenses, loading, errorMsg, hasSearched, fetchReport }
}
