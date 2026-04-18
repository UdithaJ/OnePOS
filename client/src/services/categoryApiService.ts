import axios from 'axios'

export interface CategoryPayload {
  name: string
  pricePerKg: number
  minPrice: number
  isActive: boolean
}

export interface Category {
  _id: string
  name: string
  pricePerKg: number
  minPrice: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

function baseUrl() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

export async function getAllCategories(): Promise<Category[]> {
  const response = await axios.get(`${baseUrl()}/api/categories`)
  return response.data
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const response = await axios.post(`${baseUrl()}/api/categories`, payload)
  return response.data
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>): Promise<Category> {
  const response = await axios.put(`${baseUrl()}/api/categories/${id}`, payload)
  return response.data
}

export async function deleteCategory(id: string): Promise<void> {
  await axios.delete(`${baseUrl()}/api/categories/${id}`)
}
