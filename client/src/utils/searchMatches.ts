// A search list on the touch screen is kept short, so it ends above the
// on-screen keyboard instead of running on underneath it: only the first few
// matches show, and typing more narrows them down.
export const SEARCH_LIST_LIMIT = 3

// The first `limit` items matching the query (lower-cased and trimmed before
// it reaches `matches`). The selected item is always kept, so a field that
// shows a selection can still display its label.
export function topMatches<T extends { value: unknown }>(
  items: T[],
  query: string | null | undefined,
  matches: (item: T, q: string) => boolean,
  selected?: unknown,
  limit = SEARCH_LIST_LIMIT,
): T[] {
  const q = (query || '').trim().toLowerCase()
  const list = items.filter(item => !q || matches(item, q)).slice(0, limit)
  const current = selected ? items.find(item => item.value === selected) : undefined
  if (current && !list.includes(current)) list.push(current)
  return list
}

// After a pick, an autocomplete shows the picked item's label as its search
// text. That is not something the user typed, so it counts as no search: the
// list opens unfiltered again, as it did before the pick.
export function searchOrEmpty<T extends { value: unknown }>(
  items: T[],
  search: string | null | undefined,
  selected: unknown,
  labelOf: (item: T) => string = item => String((item as { label?: unknown }).label ?? ''),
): string {
  const current = selected ? items.find(item => item.value === selected) : undefined
  return current && labelOf(current) === search ? '' : search || ''
}
