import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpensesReportRow } from '@/services/reportApiService'

const HEADERS = ['Date', 'Description', 'Amount']

function formatDate(isoString: string): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10)
}

function buildFlatRows(rawRows: ExpensesReportRow[]): string[][] {
  const seenDates = new Set<string>()

  return rawRows.map((row) => {
    const dateKey = toDateKey(row.date)
    const isFirstDate = !seenDates.has(dateKey)
    seenDates.add(dateKey)

    return [
      isFirstDate ? formatDate(row.date) : '',
      row.description,
      row.amount.toFixed(2),
    ]
  })
}

function grandTotal(rawRows: ExpensesReportRow[]): number {
  return rawRows.reduce((sum, r) => sum + r.amount, 0)
}

export function useExpensesExport() {
  async function exportToExcel(rawRows: ExpensesReportRow[], fromDate: string, toDate: string) {
    const mod = await import('xlsx')
    const XLSX = (mod && (mod as any).default) ? (mod as any).default : mod
    const data = [HEADERS, ...buildFlatRows(rawRows), ['', 'Total Expenses for the Given Period', grandTotal(rawRows).toFixed(2)]]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, `expenses-report-${fromDate}-${toDate}.xlsx`)
  }

  function exportToPDF(rawRows: ExpensesReportRow[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: 'portrait' })
    doc.setFontSize(14)
    doc.text('Expenses Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rawRows),
      foot: [['', 'Total Expenses for the Given Period', grandTotal(rawRows).toFixed(2)]],
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`expenses-report-${fromDate}-${toDate}.pdf`)
  }

  function exportToCSV(rawRows: ExpensesReportRow[], fromDate: string, toDate: string) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const rows = [HEADERS, ...buildFlatRows(rawRows), ['', 'Total Expenses for the Given Period', grandTotal(rawRows).toFixed(2)]]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-report-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
