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

export interface PendingOrdersRow {
  orderId: string
  orderNo: number
  deliveryDate: string
  status: string
  rackNumber: string | null
  customerName: string
  mobileNumber: string
  categoryName: string
  weight: number
}

export interface PendingOrdersReportParams {
  fromDate: string
  toDate: string
  status?: string
}

export async function getPendingOrdersReport(params: PendingOrdersReportParams): Promise<PendingOrdersRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/pending-orders`, { params })
  return response.data
}

export interface BankReconciliationRow {
  expenseId: string
  date: string
  description: string
  amount: number
}

export interface BankReconciliationParams {
  fromDate: string
  toDate: string
}

export async function getBankReconciliationReport(params: BankReconciliationParams): Promise<BankReconciliationRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/bank-reconciliation`, { params })
  return response.data
}

export interface ExpensesReportRow {
  expenseId: string
  date: string
  description: string
  amount: number
}

export interface ExpensesReportParams {
  fromDate: string
  toDate: string
  expenseTypeId?: string
}

export interface ExpenseCategory {
  _id: string
  name: string
  displayName: string
}

export async function getExpensesReport(params: ExpensesReportParams): Promise<ExpensesReportRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/expenses`, { params })
  return response.data
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const response = await axios.get(`${baseUrl()}/api/expense-categories`)
  return response.data
}

export interface ReturningCustomerRow {
  customerId: string
  customerName: string
  mobileNumber: string
  orderCount: number
  totalWeight: number
}

export interface ReturningCustomersParams {
  minOrderCount?: number
}

export async function getReturningCustomersReport(params: ReturningCustomersParams): Promise<ReturningCustomerRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/returning-customers`, { params })
  return response.data
}

export interface CashBoxSummaryRow {
  orderId: string
  orderNo: number
  createdDate: string
  businessDate: string | null
  customerName: string
  totalAmount: number
  dueAmount: number
  paymentMethod: string | null
  paymentReceived: number | null
}

export interface CashBoxSummaryParams {
  fromDate: string
  toDate: string
}

export async function getCashBoxSummaryReport(params: CashBoxSummaryParams): Promise<CashBoxSummaryRow[]> {
  const response = await axios.get(`${baseUrl()}/api/reports/cash-box-summary`, { params })
  return response.data
}
