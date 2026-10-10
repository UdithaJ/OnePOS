// Builds the flat cell matrix that CSV, Excel and PDF all export.
//
// Kept separate from useReportExport so it is pure and testable without
// pulling in jsPDF/xlsx — main/reports/__tests__/csv-parity.test.js compiles
// this file and asserts the CSV it produces still matches the old
// use*Export.ts output.

import type { ReportEnvelope, ReportColumn, ReportFooterEntry } from '@/types/report'
import {
  formatCell,
  formatFooter,
  columnHeader,
  spanOf,
  excelCell,
  excelFooterCell,
  type ExcelCell,
} from '@/utils/reportFormat'

/** CSV and PDF get text; Excel gets cells built by `excelMatrix`. */
export type TextTarget = 'csv' | 'pdf'

function textMode(target: TextTarget) {
  return target === 'csv' ? 'csv' : 'export'
}

export function headerRow(envelope: ReportEnvelope): string[] {
  return envelope.columns.map((column) => columnHeader(column, 'export'))
}

// A cell covered by a rowspan from above exports as blank, matching how the
// merged table reads. Both the table and this function read the same spans, so
// they cannot drift apart.
function cellRows<T>(envelope: ReportEnvelope, cell: (value: unknown, column: ReportColumn) => T): (T | '')[][] {
  return envelope.rows.map((row) =>
    envelope.columns.map((column) => {
      if (spanOf(row.spans, column.key) === 0) return ''
      return cell(row.values[column.key], column)
    }),
  )
}

export function bodyRows(envelope: ReportEnvelope, target: TextTarget): string[][] {
  return cellRows(envelope, (value, column) => formatCell(value, column, textMode(target)))
}

function footerCells<T>(envelope: ReportEnvelope, total: (entry: ReportFooterEntry) => T): (T | string)[][] {
  return envelope.footer.map((entry) => {
    const cells: (T | string)[] = new Array(envelope.columns.length).fill('')
    // In the table the label cell spans `labelSpan` columns; flattened, that
    // means the text sits in the LAST cell it covers, which is where the old
    // exporters put it.
    cells[Math.max(0, entry.labelSpan - 1)] = entry.label
    const valueIndex = envelope.columns.findIndex((column) => column.key === entry.column)
    if (valueIndex >= 0) cells[valueIndex] = total(entry)
    return cells
  })
}

export function footerRows(envelope: ReportEnvelope, target: TextTarget): string[][] {
  return footerCells(envelope, (entry) => formatFooter(entry, textMode(target)))
}

export function exportMatrix(envelope: ReportEnvelope, target: TextTarget): string[][] {
  return [headerRow(envelope), ...bodyRows(envelope, target), ...footerRows(envelope, target)]
}

export function excelMatrix(envelope: ReportEnvelope): ExcelCell[][] {
  return [
    headerRow(envelope),
    ...cellRows(envelope, excelCell),
    ...footerCells(envelope, excelFooterCell),
  ]
}

export function toCSV(matrix: string[][]): string {
  function escapeCell(value: string): string {
    const text = String(value)
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }
  return matrix.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}
