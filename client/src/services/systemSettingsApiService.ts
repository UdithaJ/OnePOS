import axios from 'axios'

export interface SystemSettings {
  _id: string
  dailyCapacityKg: number
  dueSoonLeadDays: number
}

export interface SystemSettingsPayload {
  dailyCapacityKg: number
  dueSoonLeadDays: number
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await axios.get(`${baseUrl()}/api/system-settings`)
  return res.data
}

export async function updateSystemSettings(payload: SystemSettingsPayload): Promise<SystemSettings> {
  const res = await axios.put(`${baseUrl()}/api/system-settings`, payload)
  return res.data
}

export interface CapacityCheckResult {
  ok: boolean
  pendingKg: number
  newOrderKg: number
  capacityPerDayKg: number
  daysUntilDue: number
  maxProcessableKg: number
  message: string
}

export async function checkOrderCapacity(payload: { deliveryDate: string; weightKg: number }): Promise<CapacityCheckResult> {
  const res = await axios.post(`${baseUrl()}/api/orders/check-capacity`, payload)
  return res.data
}
