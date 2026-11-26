import type { CampaignCounts, RecipientStatus, SmsCampaign } from '@/services/smsApiService'

// Labels, colours and helpers shared by the Bulk SMS campaign pages.

export const RECIPIENT_STATUS: Record<RecipientStatus, { label: string; color: string; hint: string }> = {
  pending: { label: 'Pending', color: 'grey', hint: 'Waiting to be sent' },
  retrying: { label: 'Retrying', color: 'orange', hint: 'Notify.lk did not process it; it will be tried again' },
  sending: { label: 'Sending', color: 'blue', hint: 'Being sent now' },
  accepted: { label: 'Accepted', color: 'green', hint: 'Accepted by Notify.lk. Check delivery in the Notify.lk dashboard.' },
  failed: { label: 'Failed', color: 'red', hint: 'Not sent' },
  unknown: { label: 'Unknown', color: 'deep-purple', hint: 'May or may not have been sent. Check the Notify.lk dashboard before resending.' },
  skipped: { label: 'Skipped', color: 'blue-grey', hint: 'Never sent (invalid or duplicate number, or too long)' },
  cancelled: { label: 'Cancelled', color: 'grey-darken-1', hint: 'Not sent because the campaign was cancelled' },
}

// Order the counters are shown in.
export const COUNT_ORDER: RecipientStatus[] = ['accepted', 'failed', 'unknown', 'retrying', 'pending', 'skipped', 'cancelled']

export function campaignStatus(c: SmsCampaign): { label: string; color: string } {
  switch (c.status) {
    case 'sending': return { label: 'Sending', color: 'blue' }
    case 'paused': return { label: 'Paused', color: 'orange' }
    case 'cancelled': return { label: 'Cancelled', color: 'grey' }
    case 'completed': {
      const problems = c.counts.failed + c.counts.unknown
      return problems
        ? { label: `Completed (${problems} not sent)`, color: 'red' }
        : { label: 'Completed', color: 'green' }
    }
    default: return { label: c.status, color: 'grey' }
  }
}

// Recipients the campaign tries to send to (everything except skipped).
export function sendable(counts: CampaignCounts): number {
  return counts.total - counts.skipped
}

// Recipients whose outcome is settled.
export function finished(counts: CampaignCounts): number {
  return counts.accepted + counts.failed + counts.unknown + counts.cancelled
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  if (seconds < 60) return 'under a minute'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `about ${mins} min`
  const h = Math.floor(mins / 60)
  return `about ${h} h ${mins % 60} min`
}

export function formatDateTime(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Same rules as the server's toNotifyNumber: Sri Lankan mobiles only.
export function toNotifyNumber(phone?: string | null): string | null {
  if (!phone) return null
  const m = String(phone).replace(/[\s\-()+]/g, '').match(/^(?:94|0)?(7\d{8})$/)
  return m ? `94${m[1]}` : null
}

// Same greeting as the server: "Mr Nimal", else "Customer".
export function greetingName(c: { title?: string; firstName?: string }): string {
  return [c.title, c.firstName].filter(Boolean).join(' ') || 'Customer'
}

export function renderMessage(template: string, c: { title?: string; firstName?: string }): string {
  return template.replace(/\{name\}/gi, greetingName(c))
}
