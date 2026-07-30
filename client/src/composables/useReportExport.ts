import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportEnvelope } from '@/types/report'
import { exportMatrix, headerRow, bodyRows, footerRows, toCSV, type Cell } from '@/utils/reportRows'

// One exporter for every report. It reads the same envelope the table renders,
// so a spanned cell, a per-group total or a grand total can never come out
// differently in Excel than it looks on screen — which is exactly what used to
// happen when each report had its own use*Export.ts (§1 of
// REPORT_ENGINE_ARCHITECTURE.md).

// Filenames and the PDF period line use the picker values (YYYY-MM-DD), not the
// absolute instants actually sent to the server, so they read the way they
// always have.
type DisplayParams = Record<string, string | number>

function filename(envelope: ReportEnvelope, params: DisplayParams, extension: string): string {
  const range = [params.fromDate, params.toDate].filter(Boolean).join('-')
  const base = envelope.report.exportBasename
  return range ? `${base}-${range}.${extension}` : `${base}.${extension}`
}

function periodLine(params: DisplayParams): string | null {
  const { fromDate, toDate } = params
  return fromDate && toDate ? `Period: ${fromDate} to ${toDate}` : null
}

export function useReportExport() {
  async function exportToExcel(envelope: ReportEnvelope, params: DisplayParams) {
    const mod = await import('xlsx')
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const XLSX: any = mod && (mod as any).default ? (mod as any).default : mod
    const ws = XLSX.utils.aoa_to_sheet(exportMatrix(envelope, true))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, envelope.report.sheetName)
    XLSX.writeFile(wb, filename(envelope, params, 'xlsx'))
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  function exportToPDF(envelope: ReportEnvelope, params: DisplayParams) {
    const doc = new jsPDF({ orientation: envelope.report.orientation })
    doc.setFontSize(14)
    doc.text(envelope.report.exportTitle, 14, 15)

    const period = periodLine(params)
    if (period) {
      doc.setFontSize(10)
      doc.text(period, 14, 22)
    }

    autoTable(doc, {
      head: [headerRow(envelope)],
      body: bodyRows(envelope, false) as string[][],
      foot: footerRows(envelope) as string[][],
      startY: period ? 28 : 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(filename(envelope, params, 'pdf'))
  }

  function exportToCSV(envelope: ReportEnvelope, params: DisplayParams) {
    const csv = toCSV(exportMatrix(envelope, false) as Cell[][])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename(envelope, params, 'csv')
    link.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
