// Local-timezone date helpers for date-range reports.
//
// Report APIs filter on absolute instants (createdDate/deliveryDate/date), while
// the UI shows and groups rows by the user's LOCAL calendar day. To keep the
// query window, the grouping, and the displayed date in agreement, we must:
//   * translate the picker's local day selection into the correct UTC boundary
//     instants (localDayStartISO / localDayEndISO), and
//   * group/format results by the local day (toLocalDateKey).
// Using a raw UTC substring (isoString.substring(0, 10)) drifts by the local
// offset near day boundaries, so an order can show on one day but be queried
// under the adjacent one.

function formatLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Today's date as a 'YYYY-MM-DD' string in the browser's local timezone.
// Use for date-picker defaults instead of new Date().toISOString().substring(0, 10),
// which yields the UTC date and can be off by one near midnight.
export function localToday(): string {
  return formatLocalKey(new Date())
}

// 'YYYY-MM-DD' (a local calendar day) -> ISO instant for the START of that day
// in the browser's timezone. Including the time component makes the string parse
// as local time rather than UTC.
export function localDayStartISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000`).toISOString()
}

// 'YYYY-MM-DD' (a local calendar day) -> ISO instant for the END of that day
// in the browser's timezone.
export function localDayEndISO(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString()
}

// An ISO instant -> 'YYYY-MM-DD' local-day grouping key, matching how dates are
// displayed via toLocaleDateString.
export function toLocalDateKey(isoString: string): string {
  return formatLocalKey(new Date(isoString))
}
