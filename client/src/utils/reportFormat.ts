// Cell formatting for report rendering and export.
//
// One implementation serves the table, CSV, Excel and PDF. The server sends raw
// typed values plus a format description; formatting is applied here, once.
//
// `mode: 'export'` honours the exportFormat / exportDecimals / exportLabel
// overrides, which exist purely to preserve places where the old table and the
// old export deliberately disagreed (e.g. Cash Box showed 1,500 on screen but
// wrote 1500.00 to CSV). See MIGRATION-NOTES.md.

import type { ReportColumn, ReportFooterEntry, NumberFormat } from '@/types/report'

export type FormatMode = 'display' | 'export'

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export function formatDate(value: unknown): string {
  if (isEmpty(value)) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatNumber(value: number, format: NumberFormat | undefined, decimals: number | undefined): string {
  switch (format) {
    case 'fixed':
      return value.toFixed(decimals ?? 2)
    case 'grouped':
      return value.toLocaleString()
    case 'plain':
    default:
      return String(value)
  }
}

export function formatCell(value: unknown, column: ReportColumn, mode: FormatMode = 'display'): string {
  const emptyAs = column.emptyAs ?? '-'

  switch (column.type) {
    case 'date':
      return isEmpty(value) ? emptyAs : formatDate(value)

    case 'badge': {
      if (isEmpty(value)) return emptyAs
      const mapped = column.valueMap?.[String(value)]
      return mapped ? mapped.label : String(value)
    }

    case 'number': {
      if (isEmpty(value)) return column.emptyAs ?? ''
      const num = Number(value)
      if (Number.isNaN(num)) return column.emptyAs ?? ''

      const zeroAs = mode === 'export' ? (column.exportZeroAs ?? column.zeroAs) : column.zeroAs
      if (zeroAs !== undefined && num <= 0) return zeroAs

      const format = mode === 'export' ? (column.exportFormat ?? column.format) : column.format
      const decimals = mode === 'export' ? (column.exportDecimals ?? column.decimals) : column.decimals
      return formatNumber(num, format, decimals) + (column.suffix ?? '')
    }

    case 'text':
    default: {
      if (isEmpty(value)) return emptyAs
      const text = String(value)
      return column.pad ? text.padStart(column.pad, '0') : text
    }
  }
}

export function formatFooter(entry: ReportFooterEntry, mode: FormatMode = 'display'): string {
  const format = mode === 'export' ? (entry.exportFormat ?? entry.format) : entry.format
  const decimals = mode === 'export' ? (entry.exportDecimals ?? entry.decimals) : entry.decimals
  const suffix = mode === 'export' ? (entry.exportSuffix ?? entry.suffix ?? '') : (entry.suffix ?? '')
  return formatNumber(entry.value, format, decimals) + suffix
}

export function columnHeader(column: ReportColumn, mode: FormatMode = 'display'): string {
  return mode === 'export' ? (column.exportLabel ?? column.label) : column.label
}

/** Spans are keyed by column; an absent entry means a normal, unmerged cell. */
export function spanOf(spans: Record<string, number>, key: string): number {
  return spans[key] ?? 1
}

/**
 * Excel receives real numbers rather than pre-formatted strings, so totals and
 * filters work in the spreadsheet. This is a deliberate change from the old
 * exporter, which wrote `.toFixed(2)` text into numeric columns.
 */
export function excelCell(value: unknown, column: ReportColumn): string | number {
  if (column.type !== 'number') return formatCell(value, column, 'export')
  if (isEmpty(value)) return formatCell(value, column, 'export')

  const num = Number(value)
  if (Number.isNaN(num)) return formatCell(value, column, 'export')

  const zeroAs = column.exportZeroAs ?? column.zeroAs
  if (zeroAs !== undefined && num <= 0) return zeroAs

  return num
}
