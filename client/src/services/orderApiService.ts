import axios from 'axios'

export interface OrderCategoryLineInput {
  categoryId: string
  weight: number
}

export interface CreateOrderPayload {
  customerID: string
  categoryLines: OrderCategoryLineInput[]
  deliveryDate: string
  status: string
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  createdUser: string
  rackNumber?: string
}

function baseUrl() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

export async function getOrders() {
  const response = await axios.get(`${baseUrl()}/api/orders`)
  return response.data
}

export async function createOrder(payload: CreateOrderPayload) {
  const response = await axios.post(`${baseUrl()}/api/orders`, payload)
  return response.data
}
