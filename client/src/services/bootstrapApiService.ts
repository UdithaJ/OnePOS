import axios from 'axios'

export interface BootstrapStep {
  action: string
  version: number
  status: 'pending' | 'applied' | 'skipped' | 'failed'
  detail: string
}

export interface BootstrapStatus {
  state: 'pending' | 'seeding' | 'ready' | 'failed'
  justSeeded: boolean
  steps: BootstrapStep[]
}

// First-run setup progress. Reachable before the rest of the API is useful,
// so the window can show what is happening instead of appearing to hang.
export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.get(`${baseUrl}/api/bootstrap/status`)
  return response.data
}
