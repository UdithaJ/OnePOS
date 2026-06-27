import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReturningCustomerRow } from '@/services/reportApiService'

const HEADERS = ['Customer Name', 'Mobile No', 'No of Orders', 'Total No of Kilos']

function buildFlatRows(rawRows: ReturningCustomerRow[]): string[][] {
  return rawRows.map((row) => [
    row.customerName,
    row.mobileNumber,
    String(row.orderCount),
    String(row.totalWeight),
  ])
}

export function useReturningCustomersExport() {
  async function exportToExcel(rawRows: ReturningCustomerRow[]) {
    const mod = await import('xlsx')
    const XLSX = (mod && (mod as any).default) ? (mod as any).default : mod
    const data = [HEADERS, ...buildFlatRows(rawRows)]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Returning Customers')
    XLSX.writeFile(wb, 'returning-customers-report.xlsx')
  }

  function exportToPDF(rawRows: ReturningCustomerRow[]) {
    const doc = new jsPDF({ orientation: 'portrait' })
    doc.setFontSize(14)
    doc.text('Returning Customers Report', 14, 15)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rawRows),
      startY: 24,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 61, 56] },
    })

    doc.save('returning-customers-report.pdf')
  }

  function exportToCSV(rawRows: ReturningCustomerRow[]) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const rows = [HEADERS, ...buildFlatRows(rawRows)]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'returning-customers-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
