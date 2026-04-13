import axios from 'axios'

export interface CustomerPayload {
  firstName: string
  lastName: string
  mobileNumber: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
}

export async function getAllCustomers() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/customers`)
  return response.data
}

export async function createCustomer(payload: CustomerPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/customers`, payload)
  return response.data
}
