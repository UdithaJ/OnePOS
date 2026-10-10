// Cell formatting for report rendering and export.
//
// One implementation serves the table, CSV, Excel and PDF. The server sends raw
// typed values plus a format description; formatting is applied here, once.
//
// Amounts read the way the printed bill prints them (1,950.00) on screen, in
// PDF and in Excel. CSV is the one exception: `mode: 'csv'` writes grouped
// numbers without thousands separators (1950.00), so the file imports into
// other tools as numbers rather than quoted text.
//
// `mode: 'export'` (PDF) and `mode: 'csv'` honour the export* overrides
// (exportLabel, exportZeroAs, exportSuffix, ...). See MIGRATION-NOTES.md.

import type { ReportColumn, ReportFooterEntry, NumberFormat } from '@/types/report'

export type FormatMode = 'display' | 'export' | 'csv'

/** A cell for the Excel sheet: text, or a real number carrying its display format. */
export type ExcelCell = string | { v: number; t: 'n'; z?: string }

function isExport(mode: FormatMode): boolean {
  return mode !== 'display'
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export function formatDate(value: unknown): string {
  if (isEmpty(value)) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatNumber(
  value: number,
  format: NumberFormat | undefined,
  decimals: number | undefined,
  mode: FormatMode,
): string {
  switch (format) {
    case 'fixed':
      return value.toFixed(decimals ?? 2)
    case 'grouped':
      if (mode === 'csv') return decimals === undefined ? String(value) : value.toFixed(decimals)
      // Pinned to en-US, as the bill is, so a till's system locale can't turn
      // 1,950.00 into 1.950,00.
      return value.toLocaleString(
        'en-US',
        decimals === undefined ? undefined : { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
      )
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

      const zeroAs = isExport(mode) ? (column.exportZeroAs ?? column.zeroAs) : column.zeroAs
      if (zeroAs !== undefined && num <= 0) return zeroAs

      const format = isExport(mode) ? (column.exportFormat ?? column.format) : column.format
      const decimals = isExport(mode) ? (column.exportDecimals ?? column.decimals) : column.decimals
      return formatNumber(num, format, decimals, mode) + (column.suffix ?? '')
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
  const format = isExport(mode) ? (entry.exportFormat ?? entry.format) : entry.format
  const decimals = isExport(mode) ? (entry.exportDecimals ?? entry.decimals) : entry.decimals
  const suffix = isExport(mode) ? (entry.exportSuffix ?? entry.suffix ?? '') : (entry.suffix ?? '')
  return formatNumber(entry.value, format, decimals, mode) + suffix
}

export function columnHeader(column: ReportColumn, mode: FormatMode = 'display'): string {
  return isExport(mode) ? (column.exportLabel ?? column.label) : column.label
}

/** Spans are keyed by column; an absent entry means a normal, unmerged cell. */
export function spanOf(spans: Record<string, number>, key: string): number {
  return spans[key] ?? 1
}

// The Excel number format that shows a value the way the table does:
// grouped/2 -> #,##0.00, fixed/2 -> 0.00. Plain numbers keep Excel's General.
function excelNumberFormat(format: NumberFormat | undefined, decimals: number | undefined): string | undefined {
  if (format !== 'grouped' && format !== 'fixed') return undefined
  const places = decimals ?? (format === 'fixed' ? 2 : 0)
  const fraction = places > 0 ? '.' + '0'.repeat(places) : ''
  return (format === 'grouped' ? '#,##0' : '0') + fraction
}

function excelNumber(value: number, format: NumberFormat | undefined, decimals: number | undefined): ExcelCell {
  const z = excelNumberFormat(format, decimals)
  return z ? { v: value, t: 'n', z } : { v: value, t: 'n' }
}

/**
 * Excel receives real numbers rather than pre-formatted strings, so totals and
 * filters work in the spreadsheet, with a number format that makes them read
 * the same as the table (1,950.00).
 */
export function excelCell(value: unknown, column: ReportColumn): ExcelCell {
  if (column.type !== 'number') return formatCell(value, column, 'export')
  if (isEmpty(value)) return formatCell(value, column, 'export')

  const num = Number(value)
  if (Number.isNaN(num)) return formatCell(value, column, 'export')

  const zeroAs = column.exportZeroAs ?? column.zeroAs
  if (zeroAs !== undefined && num <= 0) return zeroAs

  return excelNumber(num, column.exportFormat ?? column.format, column.exportDecimals ?? column.decimals)
}

/** A footer total as a real Excel number; one with a unit suffix stays text. */
export function excelFooterCell(entry: ReportFooterEntry): ExcelCell {
  if (entry.exportSuffix ?? entry.suffix) return formatFooter(entry, 'export')
  return excelNumber(entry.value, entry.exportFormat ?? entry.format, entry.exportDecimals ?? entry.decimals)
}
