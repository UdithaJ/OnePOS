import { ref, computed, watch } from 'vue'
import { getReportCatalog, runReport, getOptionsFromEndpoint } from '@/services/reportApiService'
import type { ReportCatalogEntry, ReportEnvelope, ReportParam, SelectOption } from '@/types/report'
import { localToday, localDayStartISO, localDayEndISO } from '@/utils/reportDate'

// The catalog is small and static for the life of the app, so it is fetched
// once and shared by the nav menu and every report page.
const catalog = ref<ReportCatalogEntry[]>([])
const catalogLoaded = ref(false)
let catalogRequest: Promise<void> | null = null

export function useReportCatalog() {
  function loadCatalog(): Promise<void> {
    if (catalogLoaded.value) return Promise.resolve()
    if (!catalogRequest) {
      catalogRequest = getReportCatalog()
        .then((entries) => {
          catalog.value = entries
          catalogLoaded.value = true
        })
        .catch(() => {
          // Nav falls back to empty; the report page surfaces the error.
        })
        .finally(() => {
          catalogRequest = null
        })
    }
    return catalogRequest
  }

  return { catalog, catalogLoaded, loadCatalog }
}

function defaultValue(param: ReportParam): string | number {
  if (param.type === 'date') return param.default === 'today' ? localToday() : String(param.default ?? localToday())
  return param.default ?? (param.type === 'number' ? 0 : '')
}

// Date params are sent as absolute instants at the local start/end of the
// chosen day — the convention the backend already assumed. The picker value
// stays as YYYY-MM-DD for display and export filenames.
function toQueryValue(param: ReportParam, value: string | number): string | number {
  if (param.type !== 'date') return value
  if (param.bind === 'dayStart') return localDayStartISO(String(value))
  if (param.bind === 'dayEnd') return localDayEndISO(String(value))
  return value
}

export function useReport(reportId: () => string) {
  const { catalog, catalogLoaded, loadCatalog } = useReportCatalog()

  const envelope = ref<ReportEnvelope | null>(null)
  const loading = ref(false)
  const errorMsg = ref('')
  const hasSearched = ref(false)
  const paramValues = ref<Record<string, string | number>>({})
  const remoteOptions = ref<Record<string, SelectOption[]>>({})

  const spec = computed(() => catalog.value.find((entry) => entry.id === reportId()) ?? null)
  const params = computed<ReportParam[]>(() => spec.value?.params ?? [])
  const title = computed(() => spec.value?.title ?? '')

  const emptyMessage = computed(() => {
    const message = spec.value?.emptyMessage ?? 'No data found for the selected filters.'
    // Definitions may interpolate a param, e.g. "...more than {minOrderCount} order(s)."
    return message.replace(/\{(\w+)\}/g, (_, name) => String(paramValues.value[name] ?? ''))
  })

  const isEmpty = computed(
    () => hasSearched.value && !loading.value && !errorMsg.value && (envelope.value?.rows.length ?? 0) === 0,
  )

  function resetParams() {
    const next: Record<string, string | number> = {}
    for (const param of params.value) next[param.name] = defaultValue(param)
    paramValues.value = next
  }

  async function loadRemoteOptions() {
    for (const param of params.value) {
      const source = param.optionsFrom
      if (!source || remoteOptions.value[param.name]) continue

      try {
        const rows = await getOptionsFromEndpoint(source.endpoint)
        const notMatching = source.filter?.labelNotMatching
          ? new RegExp(source.filter.labelNotMatching, 'i')
          : null

        const options = rows
          .filter((row) => !source.filter?.type || row.type === source.filter.type)
          .filter((row) => !notMatching || !notMatching.test(String(row[source.labelField])))
          .map((row) => ({
            label: String(row[source.labelField]),
            value: String(row[source.valueField]),
          }))

        remoteOptions.value[param.name] = source.includeAll
          ? [source.includeAll, ...options]
          : options
      } catch {
        // Dropdown stays empty; the report can still be generated.
        remoteOptions.value[param.name] = source.includeAll ? [source.includeAll] : []
      }
    }
  }

  function optionsFor(param: ReportParam): SelectOption[] {
    return param.options ?? remoteOptions.value[param.name] ?? []
  }

  async function fetchReport() {
    loading.value = true
    errorMsg.value = ''
    hasSearched.value = true
    try {
      const query: Record<string, string | number> = {}
      for (const param of params.value) {
        query[param.name] = toQueryValue(param, paramValues.value[param.name])
      }
      envelope.value = await runReport(reportId(), query)
    } catch (err: unknown) {
      envelope.value = null
      errorMsg.value = extractMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function initialise() {
    await loadCatalog()
    resetParams()
    await loadRemoteOptions()
  }

  // Switching reports via the nav reuses this component instance, so params and
  // results must be rebuilt rather than carried across.
  watch(reportId, async () => {
    envelope.value = null
    errorMsg.value = ''
    hasSearched.value = false
    await initialise()
  })

  return {
    spec,
    catalogLoaded,
    title,
    params,
    paramValues,
    optionsFor,
    envelope,
    loading,
    errorMsg,
    hasSearched,
    isEmpty,
    emptyMessage,
    fetchReport,
    initialise,
  }
}

function extractMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const response = (err as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return err instanceof Error ? err.message : 'Failed to load report'
}
