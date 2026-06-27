import axios from 'axios'

export interface CategoryPayload {
  name: string
  minimumPrice: number
  unitPrice: number
}

export interface Category {
  _id: string
  name: string
  minimumPrice: number
  unitPrice: number
  inUse?: boolean
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function getAllCategories(): Promise<Category[]> {
  const res = await axios.get(`${baseUrl()}/api/categories`)
  return res.data
}

export async function getCategoryById(id: string): Promise<Category> {
  const res = await axios.get(`${baseUrl()}/api/categories/${id}`)
  return res.data
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const res = await axios.post(`${baseUrl()}/api/categories`, payload)
  return res.data
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>): Promise<Category> {
  const res = await axios.put(`${baseUrl()}/api/categories/${id}`, payload)
  return res.data
}

export async function deleteCategory(id: string): Promise<void> {
  await axios.delete(`${baseUrl()}/api/categories/${id}`)
}
