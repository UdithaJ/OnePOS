import axios from 'axios'

export interface ExpensePayload {
  expenseType: string
  amount: number
  userId: string
  sessionId: string
  flowType: 'inflow' | 'outflow'
}

export interface Expense {
  _id: string
  expenseType: string
  amount: number
  userId: string
  sessionId: string
  date: string
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function createExpense(payload: ExpensePayload): Promise<Expense> {
  const res = await axios.post(`${baseUrl()}/api/expenses`, payload)
  return res.data
}
