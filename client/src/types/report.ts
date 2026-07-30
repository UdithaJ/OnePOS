// Types for the ReportEnvelope returned by GET /api/reports/:id.
//
// Mirrors main/reports/schema/report.schema.json. Both the table and the
// exporter consume these — there is deliberately no second, export-specific
// shape, because that split is what let the old table and CSV disagree.

export type ColumnType = 'text' | 'number' | 'date' | 'badge'
export type NumberFormat = 'fixed' | 'grouped' | 'plain'
export type Align = 'left' | 'right' | 'center'

export interface BadgeValue {
  label: string
  variant: string
}

export interface ReportColumn {
  key: string
  label: string
  type: ColumnType
  align?: Align
  format?: NumberFormat
  decimals?: number
  /** Zero-pad a numeric value rendered as text, e.g. order no 12 -> "0012". */
  pad?: number
  /** Rendered instead of a value <= 0. */
  zeroAs?: string
  /** Rendered instead of null / undefined / ''. */
  emptyAs?: string
  suffix?: string
  emphasis?: boolean
  valueMap?: Record<string, BadgeValue>
  /** Overrides used only where the legacy table and export deliberately
   *  disagreed; see MIGRATION-NOTES.md. */
  exportLabel?: string
  exportFormat?: NumberFormat
  exportDecimals?: number
  exportZeroAs?: string
}

export interface ReportRow {
  values: Record<string, unknown>
  /** Keyed by column: 0 = suppressed (covered from above), n = rowspan.
   *  Absent means 1. */
  spans: Record<string, number>
}

export interface ReportFooterEntry {
  label: string
  column: string
  value: number
  /** Derived server-side from the column index — the old hand-written colspan. */
  labelSpan: number
  format?: NumberFormat
  decimals?: number
  suffix?: string
  exportFormat?: NumberFormat
  exportDecimals?: number
  exportSuffix?: string
}

export interface ReportEnvelope {
  report: {
    id: string
    title: string
    exportTitle: string
    exportBasename: string
    sheetName: string
    orientation: 'portrait' | 'landscape'
    emptyMessage: string
    generatedAt: string
    params: Record<string, string>
  }
  columns: ReportColumn[]
  rows: ReportRow[]
  footer: ReportFooterEntry[]
  meta: { rowCount: number }
}

// --- Catalog & parameters -------------------------------------------------

export interface ReportCatalogEntry {
  id: string
  title: string
  menuTitle: string
  group: string
  icon: string
  permission: string | null
  order: number
  emptyMessage: string
  params: ReportParam[]
}

export interface SelectOption {
  label: string
  value: string
}

export interface ReportParamOptionsFrom {
  endpoint: string
  valueField: string
  labelField: string
  includeAll?: SelectOption
  filter?: { type?: string; labelNotMatching?: string }
}

export interface ReportParam {
  name: string
  type: 'date' | 'number' | 'text' | 'select'
  label: string
  default?: string | number
  required?: boolean
  /** Marks a date param as the local start/end of the chosen day. */
  bind?: 'dayStart' | 'dayEnd'
  options?: SelectOption[]
  optionsFrom?: ReportParamOptionsFrom
  min?: number
  width?: number
  placeholder?: string
}

