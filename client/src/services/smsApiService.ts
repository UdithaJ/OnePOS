import axios from 'axios'

export async function sendBulkSms(payload: { message: string; customerIds: string[] }) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/sms/bulk`, payload)
  return response.data as { sent: number }
}
