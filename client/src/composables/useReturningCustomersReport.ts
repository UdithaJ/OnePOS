import { ref, computed } from 'vue'
import { getReturningCustomersReport, type ReturningCustomerRow } from '@/services/reportApiService'

export function useReturningCustomersReport() {
  const minOrderCount = ref<number | null>(1)
  const rawRows = ref<ReturningCustomerRow[]>([])
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)

  const totalKilos = computed(() => rawRows.value.reduce((sum, r) => sum + r.totalWeight, 0))

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      rawRows.value = await getReturningCustomersReport({
        minOrderCount: minOrderCount.value ?? 0,
      })
    } catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load report'
    } finally {
      loading.value = false
    }
  }

  return { minOrderCount, rawRows, totalKilos, loading, errorMsg, hasSearched, fetchReport }
}
