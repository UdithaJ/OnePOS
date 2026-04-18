import axios from 'axios'

export interface OrderPayload {
  customerID: string
  weight: number
  deliveryDate: string
  totalAmount: number
  // Add other fields as needed
}


export async function createOrder(payload: OrderPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/orders`, payload)
  return response.data
}

export async function getAllOrders() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/orders`)
  return response.data
}
