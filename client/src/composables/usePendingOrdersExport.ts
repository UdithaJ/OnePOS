import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PendingOrdersRow } from '@/services/reportApiService'

const HEADERS = ['Due Date', 'Order No', 'Customer', 'Mobile No', 'Status', 'Rack No', 'Laundry Category', 'Weight (kg)']

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

function buildFlatRows(rawRows: PendingOrdersRow[]): string[][] {
  const seenOrders = new Set<string>()

  return rawRows.map((row) => {
    const orderId = String(row.orderId)
    const isFirstOrder = !seenOrders.has(orderId)
    seenOrders.add(orderId)

    return [
      isFirstOrder ? formatDate(row.deliveryDate) : '',
      isFirstOrder ? String(row.orderNo).padStart(4, '0') : '',
      isFirstOrder ? row.customerName : '',
      isFirstOrder ? row.mobileNumber : '',
      isFirstOrder ? (STATUS_DISPLAY[row.status] ?? row.status) : '',
      isFirstOrder ? (row.rackNumber ?? '-') : '',
      row.categoryName,
      String(row.weight),
    ]
  })
}

function grandTotal(rawRows: PendingOrdersRow[]): number {
  return rawRows.reduce((sum, r) => sum + r.weight, 0)
}

export function usePendingOrdersExport() {
  async function exportToExcel(rawRows: PendingOrdersRow[], fromDate: string, toDate: string) {
    const mod = await import('xlsx')
    const XLSX = (mod && (mod as any).default) ? (mod as any).default : mod
    const data = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', 'Total Pending Weight', String(grandTotal(rawRows))]]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Orders')
    XLSX.writeFile(wb, `pending-orders-report-${fromDate}-${toDate}.xlsx`)
  }

  function exportToPDF(rawRows: PendingOrdersRow[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Pending Orders by Due Date', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rawRows),
      foot: [['', '', '', '', '', '', 'Total Pending Weight', String(grandTotal(rawRows))]],
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`pending-orders-report-${fromDate}-${toDate}.pdf`)
  }

  function exportToCSV(rawRows: PendingOrdersRow[], fromDate: string, toDate: string) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const rows = [HEADERS, ...buildFlatRows(rawRows), ['', '', '', '', '', '', 'Total Pending Weight', String(grandTotal(rawRows))]]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pending-orders-report-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
