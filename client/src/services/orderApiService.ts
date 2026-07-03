
export async function getOrderById(orderId: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/orders/${orderId}`)
  return response.data
}

export async function updateOrder(orderId: string, payload: Partial<OrderPayload>) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.put(`${baseUrl}/api/orders/${orderId}`, payload)
  return response.data
}
import axios from 'axios'

export interface OrderPayload {
  customerID: string
  deliveryDate: string
  totalAmount?: number
  discount?: number
  suborders?: any[]
  status?: string
  rackNumber?: string
}


export async function createOrder(payload: OrderPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/orders`, payload)
  return response.data
}

export interface OrdersParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  deliveryDateFrom?: string
  deliveryDateTo?: string
  customerID?: string
  createdDateFrom?: string
  createdDateTo?: string
  search?: string
}

export interface OrdersPage {
  orders: any[]
  total: number
  page: number
  limit: number
}

export async function getOrders(params: OrdersParams = {}): Promise<OrdersPage> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/orders`, { params })
  return response.data
}

/** @deprecated use getOrders() */
export async function getAllOrders() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/orders`, { params: { page: 1, limit: 999 } })
  return (response.data as OrdersPage).orders
}
