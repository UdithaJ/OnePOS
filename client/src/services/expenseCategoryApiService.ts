import axios from 'axios'

export interface ExpenseCategoryPayload {
  name: string
  displayName: string
  type: 'inflow' | 'outflow'
}

export interface ExpenseCategory {
  _id: string
  name: string
  displayName: string
  type: 'inflow' | 'outflow'
  inUse?: boolean
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function getAllExpenseCategories(): Promise<ExpenseCategory[]> {
  const res = await axios.get(`${baseUrl()}/api/expense-categories`)
  return res.data
}

export async function getExpenseCategoryById(id: string): Promise<ExpenseCategory> {
  const res = await axios.get(`${baseUrl()}/api/expense-categories/${id}`)
  return res.data
}

export async function createExpenseCategory(payload: ExpenseCategoryPayload): Promise<ExpenseCategory> {
  const res = await axios.post(`${baseUrl()}/api/expense-categories`, payload)
  return res.data
}

export async function updateExpenseCategory(id: string, payload: Partial<ExpenseCategoryPayload>): Promise<ExpenseCategory> {
  const res = await axios.put(`${baseUrl()}/api/expense-categories/${id}`, payload)
  return res.data
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await axios.delete(`${baseUrl()}/api/expense-categories/${id}`)
}
