import { ref, computed } from 'vue'
import { getCashBoxSummaryReport, type CashBoxSummaryRow } from '@/services/reportApiService'

export const PAYMENT_METHOD_DISPLAY: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
}

export function useCashBoxSummaryReport() {
  const today = new Date().toISOString().substring(0, 10)
  const fromDate = ref(today)
  const toDate = ref(today)
  const rawRows = ref<CashBoxSummaryRow[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const totalAmountReceived = computed(() =>
    rawRows.value.reduce((sum, r) => sum + (r.paymentReceived ?? 0), 0)
  )

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getCashBoxSummaryReport({
        fromDate: fromDate.value,
        toDate: toDate.value,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  return { fromDate, toDate, rawRows, totalAmountReceived, loading, errorMsg, hasSearched, fetchReport }
}
