import axios from 'axios'

export interface StatusRow {
  _id: string
  name: string
  displayName: string
}

function baseUrl() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

export async function getAllStatuses(): Promise<StatusRow[]> {
  const response = await axios.get(`${baseUrl()}/api/statuses`)
  return response.data
}
