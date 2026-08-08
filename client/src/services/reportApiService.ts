import axios from 'axios'
import type { ReportCatalogEntry, ReportEnvelope } from '@/types/report'

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

/** Catalog of every report the backend defines — drives the nav menu and the
 *  filter bar. Adding a definition file adds a report here with no frontend
 *  change. */
export async function getReportCatalog(): Promise<ReportCatalogEntry[]> {
  const response = await axios.get(`${baseUrl()}/api/reports`)
  return response.data
}

/** Runs any report. Params are whatever the definition declares; `tz` lets the
 *  engine bucket rows by the same local day the UI displays. */
export async function runReport(
  id: string,
  params: Record<string, string | number>,
): Promise<ReportEnvelope> {
  const response = await axios.get(`${baseUrl()}/api/reports/${id}`, {
    params: { ...params, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })
  return response.data
}

export interface ExpenseCategory {
  _id: string
  name: string
  displayName: string
  type?: 'inflow' | 'outflow'
  inUse?: boolean
}

/** Backs `optionsFrom` params (currently the Expenses report's type filter). */
export async function getOptionsFromEndpoint(endpoint: string): Promise<Record<string, unknown>[]> {
  const response = await axios.get(`${baseUrl()}${endpoint}`)
  return response.data
}
