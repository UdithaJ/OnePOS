import axios from 'axios'

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export interface UpgradeOperationPreview {
  op: string
  collection: string
  summary: string
  matched: number
  willInsert: number
  sample: any[]
  update?: Record<string, any>
  note: string
}

export interface UpgradePreview {
  action: string
  version: number
  description: string
  operations: UpgradeOperationPreview[]
  alreadyApplied: boolean
  appliedAt: string | null
}

export interface UpgradeResult {
  action: string
  version: number
  status: 'success' | 'failed'
  detail: string
  results: Array<Record<string, any>>
  logId: string
  partiallyApplied: boolean
}

export interface HistoryEntry {
  _id: string
  action: string
  version: number
  status: 'success' | 'failed'
  detail: string
  runAt: string
  durationMs: number
  isUpgrade: boolean
  results: Array<Record<string, any>> | null
}

// The script is already a JSON object by the time it gets here — the browser
// parses the chosen file — so it posts as an ordinary body with no upload.
export async function previewUpgrade(script: any, actingUserId?: string): Promise<UpgradePreview> {
  const { data } = await axios.post(`${baseUrl()}/api/upgrades/preview`, { script, actingUserId })
  return data
}

export async function applyUpgrade(script: any, actingUserId?: string): Promise<UpgradeResult> {
  const { data } = await axios.post(`${baseUrl()}/api/upgrades/apply`, { script, actingUserId })
  return data
}

export async function getUpgradeHistory(actingUserId?: string): Promise<HistoryEntry[]> {
  const { data } = await axios.get(`${baseUrl()}/api/upgrades/history`, { params: { actingUserId } })
  return data
}
