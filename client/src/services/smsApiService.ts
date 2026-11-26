import axios from 'axios'

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export type CampaignStatus = 'sending' | 'paused' | 'completed' | 'cancelled'
export type RecipientStatus =
  | 'pending' | 'retrying' | 'sending' | 'accepted' | 'failed' | 'unknown' | 'skipped' | 'cancelled'

export type CampaignCounts = Record<RecipientStatus, number> & { total: number }

export interface SmsCampaign {
  _id: string
  name: string
  message: string
  senderId?: string
  status: CampaignStatus
  pauseReason: string | null
  createdBy?: string | null
  createdAt: string
  startedAt?: string
  completedAt?: string | null
  cancelledAt?: string | null
  counts: CampaignCounts
  etaSeconds: number | null
  requeued?: number
}

export interface SmsRecipient {
  _id: string
  name: string
  mobileNumber: string
  status: RecipientStatus
  attempts: number
  reason: string | null
  updatedAt: string
  acceptedAt?: string | null
}

export interface SmsConfig {
  configured: boolean
  senderId: string
  maxLength: number
  concurrency: number
  batchDelayMs: number
}

export async function getSmsConfig(): Promise<SmsConfig> {
  return (await axios.get(`${baseUrl()}/api/sms/config`)).data
}

export async function sendTestSms(payload: { to: string; message: string }): Promise<{ ok: boolean; outcome: string; reason: string | null }> {
  return (await axios.post(`${baseUrl()}/api/sms/test`, payload)).data
}

export async function listCampaigns(): Promise<SmsCampaign[]> {
  return (await axios.get(`${baseUrl()}/api/sms/campaigns`)).data
}

export async function createCampaign(payload: { name: string; message: string; customerIds: string[]; createdBy?: string }): Promise<SmsCampaign> {
  return (await axios.post(`${baseUrl()}/api/sms/campaigns`, payload)).data
}

export async function getCampaign(id: string): Promise<SmsCampaign> {
  return (await axios.get(`${baseUrl()}/api/sms/campaigns/${id}`)).data
}

export async function listRecipients(
  id: string,
  params: { status?: string; search?: string; page: number; limit: number },
): Promise<{ items: SmsRecipient[]; total: number; page: number; limit: number }> {
  return (await axios.get(`${baseUrl()}/api/sms/campaigns/${id}/recipients`, { params })).data
}

export async function exportRecipientsCsv(id: string, status?: string): Promise<{ blob: Blob; filename: string }> {
  const res = await axios.get(`${baseUrl()}/api/sms/campaigns/${id}/export`, { params: { status }, responseType: 'blob' })
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')
  return { blob: res.data, filename: match?.[1] || 'sms-recipients.csv' }
}

export async function pauseCampaign(id: string): Promise<SmsCampaign> {
  return (await axios.post(`${baseUrl()}/api/sms/campaigns/${id}/pause`)).data
}

export async function resumeCampaign(id: string): Promise<SmsCampaign> {
  return (await axios.post(`${baseUrl()}/api/sms/campaigns/${id}/resume`)).data
}

export async function cancelCampaign(id: string): Promise<SmsCampaign> {
  return (await axios.post(`${baseUrl()}/api/sms/campaigns/${id}/cancel`)).data
}

export async function deleteCampaign(id: string): Promise<{ deleted: boolean }> {
  return (await axios.delete(`${baseUrl()}/api/sms/campaigns/${id}`)).data
}

export async function resendCampaign(id: string, includeUnknown: boolean): Promise<SmsCampaign> {
  return (await axios.post(`${baseUrl()}/api/sms/campaigns/${id}/resend`, { includeUnknown })).data
}
