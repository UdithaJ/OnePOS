import axios from 'axios'

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export interface CustomerImportRow {
  line: number
  title: string
  firstName: string
  lastName: string
  mobileNumber: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  errors: string[]
}

export interface CustomerImportPreview {
  rows: CustomerImportRow[]
  total: number
  invalid: number
  valid: boolean
}

export interface CustomerImportResult {
  imported: number
}

// The browser reads the file and posts its text, so the server never handles
// an upload.
export async function previewCustomerImport(csv: string, actingUserId?: string): Promise<CustomerImportPreview> {
  const { data } = await axios.post(`${baseUrl()}/api/customer-import/preview`, { csv, actingUserId })
  return data
}

export async function applyCustomerImport(csv: string, actingUserId?: string): Promise<CustomerImportResult> {
  const { data } = await axios.post(`${baseUrl()}/api/customer-import/apply`, { csv, actingUserId })
  return data
}
