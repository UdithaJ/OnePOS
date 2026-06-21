import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BankTransferTrackingRow } from '@/services/reportApiService'

const HEADERS = ['Order No', 'Order Created Date', 'Bank Transfer Date', 'Customer', 'Order Amount', 'Due Amount', 'Bank Transfer Amount']

function formatDate(isoString: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function buildFlatRows(rows: BankTransferTrackingRow[]): string[][] {
  return rows.map((row) => [
    String(row.orderNo).padStart(4, '0'),
    formatDate(row.createdDate),
    formatDate(row.bankTransferDate),
    row.customerName,
    row.totalAmount.toFixed(2),
    row.dueAmount > 0 ? row.dueAmount.toFixed(2) : '-',
    row.bankTransferAmount.toFixed(2),
  ])
}

function grandTotal(rows: BankTransferTrackingRow[]): number {
  return rows.reduce((sum, r) => sum + (r.bankTransferAmount ?? 0), 0)
}

export function useBankTransferExport() {
  function exportToExcel(rows: BankTransferTrackingRow[], fromDate: string, toDate: string) {
    const data = [HEADERS, ...buildFlatRows(rows), ['', '', '', '', '', 'Total Amount Received', grandTotal(rows).toFixed(2)]]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Transfer Tracking')
    XLSX.writeFile(wb, `bank-transfer-tracking-${fromDate}-${toDate}.xlsx`)
  }

  function exportToPDF(rows: BankTransferTrackingRow[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Bank Transfer Tracking Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22)

    autoTable(doc, {
      head: [HEADERS],
      body: buildFlatRows(rows),
      foot: [['', '', '', '', '', 'Total Amount Received', grandTotal(rows).toFixed(2)]],
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 61, 56] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    doc.save(`bank-transfer-tracking-${fromDate}-${toDate}.pdf`)
  }

  function exportToCSV(rows: BankTransferTrackingRow[], fromDate: string, toDate: string) {
    function escapeCell(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const data = [HEADERS, ...buildFlatRows(rows), ['', '', '', '', '', 'Total Amount Received', grandTotal(rows).toFixed(2)]]
    const csv = data.map((row) => row.map(escapeCell).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bank-transfer-tracking-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToExcel, exportToPDF, exportToCSV }
}
