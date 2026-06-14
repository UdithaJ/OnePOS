import axios from 'axios'

export interface DailySalesRow {
  orderId: string
  orderNo: number
  createdDate: string
  deliveryDate: string
  status: string
  rackNumber: string | null
  customerName: string
  categoryName: string
  weight: number
  amount: number
}

export interface DailySalesReportParams {
  fromDate: string
  toDate: string
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function getDailySalesReport(params: DailySalesReportParams): Promise<DailySalesRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/daily-sales`, { params })
  return response.data
}
