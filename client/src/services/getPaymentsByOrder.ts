import axios from 'axios'

export async function getPaymentsByOrder(orderId: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/payments/order/${orderId}`)
  return response.data
}
