import axios from 'axios'

export interface PaymentPayload {
  orderId: string
  amount: number
  paymentMethod: string
  type: string
}

export async function makePayment(payload: PaymentPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/payments`, payload)
  return response.data
}
