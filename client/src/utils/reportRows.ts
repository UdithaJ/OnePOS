// Builds the flat cell matrix that CSV, Excel and PDF all export.
//
// Kept separate from useReportExport so it is pure and testable without
// pulling in jsPDF/xlsx — main/reports/__tests__/csv-parity.test.js compiles
// this file and asserts the CSV it produces still matches the old
// use*Export.ts output.

import type { ReportEnvelope } from '@/types/report'
import { formatCell, formatFooter, columnHeader, spanOf, excelCell } from '@/utils/reportFormat'

export type Cell = string | number

export function headerRow(envelope: ReportEnvelope): string[] {
  return envelope.columns.map((column) => columnHeader(column, 'export'))
}

// A cell covered by a rowspan from above exports as blank, matching how the
// merged table reads. Both the table and this function read the same spans, so
// they cannot drift apart.
export function bodyRows(envelope: ReportEnvelope, forExcel: boolean): Cell[][] {
  return envelope.rows.map((row) =>
    envelope.columns.map((column) => {
      if (spanOf(row.spans, column.key) === 0) return ''
      const value = row.values[column.key]
      return forExcel ? excelCell(value, column) : formatCell(value, column, 'export')
    }),
  )
}

export function footerRows(envelope: ReportEnvelope): Cell[][] {
  return envelope.footer.map((entry) => {
    const cells: Cell[] = new Array(envelope.columns.length).fill('')
    // In the table the label cell spans `labelSpan` columns; flattened, that
    // means the text sits in the LAST cell it covers, which is where the old
    // exporters put it.
    cells[Math.max(0, entry.labelSpan - 1)] = entry.label
    const valueIndex = envelope.columns.findIndex((column) => column.key === entry.column)
    if (valueIndex >= 0) cells[valueIndex] = formatFooter(entry, 'export')
    return cells
  })
}

export function exportMatrix(envelope: ReportEnvelope, forExcel = false): Cell[][] {
  return [headerRow(envelope), ...bodyRows(envelope, forExcel), ...footerRows(envelope)]
}

export function toCSV(matrix: Cell[][]): string {
  function escapeCell(value: Cell): string {
    const text = String(value)
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }
  return matrix.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}
