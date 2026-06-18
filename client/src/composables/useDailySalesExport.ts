import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DailySalesRow } from '@/services/reportApiService'

const HEADERS = ['Date', 'Order No', 'Customer', 'Delivery Date', 'Status', 'Rack No', 'Laundry Category', 'Weight (kg)', 'Amount', 'Total Amount']

const STATUS_DISPLAY: Record<string, string> = {
  todo: 'To Do',
  done: 'Done',
  cancelled: 'Cancelled',
}

function formatDate(isoString: string): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateKey(isoString: string): string {
  return isoString.substring(0, 10)
}

function buildFlatRows(rawRows: DailySalesRow[]): string[][] {
  // Group by dateKey to compute date totals
  const dateTotals = new Map<string, number>()
  for (const row of rawRows) {
    const key = toDateKey(row.createdDate)
    dateTotals.set(key, (dateTotals.get(key) ?? 0) + row.amount)
  }

  // Track which orderIds and dateKeys have been output (for "first row" logic)
  const seenOrders = new Set<string>()
  const seenDates = new Set<string>()

  return rawRows.map((row) => {
    const dateKey = toDateKey(row.createdDate)
    const orderId = String(row.orderId)
    const isFirstOrder = !seenOrders.has(orderId)
    const isFirstDate = !seenDates.has(dateKey)
    seenOrders.add(orderId)
    seenDates.add(dateKey)

    return [
      isFirstOrder ? formatDate(row.createdDate) : '',
      isFirstOrder ? String(row.orderNo).padStart(4, '0') : '',
      isFirstOrder ? row.customerName : '',
      isFirstOrder ? formatDate(row.deliveryDate) : '',
      isFirstOrder ? (STATUS_DISPLAY[row.status] ?? row.status) : '',
      isFirstOrder ? (row.rackNumber ?? '-') : '',
      row.categoryName,
      String(row.weight),
      row.amount.toFixed(2),
      isFirstDate ? (dateTotals.get(dateKey) ?? 0).toFixed(2) : '',
    ]
  })
}

function grandTotal(rawRows: DailySalesRow[]): number {
  return rawRows.reduce((sum, r) => sum + r.amount, 0)
}

export function useDailySalesExport() {
  function exportToExcel(rawRows: DailySalesRow[], fromDate: string, toDate: string) {
    const data = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', '', '', 'Total for the given period', grandTotal(rawRows).toFixed(2)]]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Sales')
    XLSX.writeFile(wb, `daily-sales-report-${fromDate}-${toDate}.xlsx`)
  }

  function exportToPDF(rawRows: DailySalesRow[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Daily Sales Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rawRows),
      foot: [['', '', '', '', '', '', '', '', 'Total for the given period', grandTotal(rawRows).toFixed(2)]],
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`daily-sales-report-${fromDate}-${toDate}.pdf`)
  }

  function exportToCSV(rawRows: DailySalesRow[], fromDate: string, toDate: string) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const rows = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', '', '', 'Total for the given period', grandTotal(rawRows).toFixed(2)]]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-sales-report-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
