import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CashBoxSummaryRow } from '@/services/reportApiService'
import { PAYMENT_METHOD_DISPLAY } from '@/composables/useCashBoxSummaryReport'

const HEADERS = ['Order No', 'Order Created Date', 'Business Date', 'Customer', 'Order Amount', 'Due Amount', 'Payment Method', 'Payment Received']

function formatDate(isoString: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function buildFlatRows(rawRows: CashBoxSummaryRow[]): string[][] {
  return rawRows.map((row) => [
    String(row.orderNo).padStart(4, '0'),
    formatDate(row.createdDate),
    formatDate(row.businessDate),
    row.customerName,
    row.totalAmount.toFixed(2),
    row.dueAmount > 0 ? row.dueAmount.toFixed(2) : '-',
    row.paymentMethod ? (PAYMENT_METHOD_DISPLAY[row.paymentMethod] ?? row.paymentMethod) : '-',
    row.paymentReceived != null ? row.paymentReceived.toFixed(2) : '-',
  ])
}

function grandTotal(rawRows: CashBoxSummaryRow[]): number {
  return rawRows.reduce((sum, r) => sum + (r.paymentReceived ?? 0), 0)
}

export function useCashBoxSummaryExport() {
  function exportToExcel(rawRows: CashBoxSummaryRow[], fromDate: string, toDate: string) {
    const data = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', 'Total Amount Received', grandTotal(rawRows).toFixed(2)]]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Box Summary')
    XLSX.writeFile(wb, `cash-box-summary-${fromDate}-${toDate}.xlsx`)
  }

  function exportToPDF(rawRows: CashBoxSummaryRow[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Cash Box Summary Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rawRows),
      foot: [['', '', '', '', '', '', 'Total Amount Received', grandTotal(rawRows).toFixed(2)]],
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`cash-box-summary-${fromDate}-${toDate}.pdf`)
  }

  function exportToCSV(rawRows: CashBoxSummaryRow[], fromDate: string, toDate: string) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const rows = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', 'Total Amount Received', grandTotal(rawRows).toFixed(2)]]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-box-summary-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
