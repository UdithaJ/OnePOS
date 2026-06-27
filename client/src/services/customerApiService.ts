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

export async function sendOtp(mobileNumber: string, customer?: CustomerPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/customers/send-otp`, { mobileNumber, customer })
  return response.data
}

export async function verifyOtp(mobileNumber: string, otp: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/customers/verify-otp`, { mobileNumber, otp })
  return response.data
}

export async function updateCustomer(id: string, payload: CustomerPayload) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.put(`${baseUrl}/api/customers/${id}`, payload)
  return response.data
}

export async function deleteCustomer(id: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.delete(`${baseUrl}/api/customers/${id}`)
  return response.data
}
