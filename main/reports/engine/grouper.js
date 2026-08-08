// Grouping, row-span and group-aggregate computation.
//
// This is the module that exists to kill the divergence described in §1 of
// REPORT_ENGINE_ARCHITECTURE.md: grouping and totals used to be implemented
// once in each report's `use*Report.ts` (for the table) and again in its
// `use*Export.ts` (for Excel/PDF/CSV). Both consumers now read the spans and
// aggregates computed here, so they cannot disagree.
//
// Groups are declared outer-to-inner. Rows are ordered by first appearance of
// each group key, which reproduces the Map-insertion ordering the old
// composables relied on.

// YYYY-MM-DD in the given IANA zone. 'en-CA' formats as YYYY-MM-DD, matching
// the client's formatLocalKey() in utils/reportDate.ts — the two must agree or
// rows bucket under a different day than the one displayed.
function localDateKey(value, timezone) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function groupKey(row, groupDef, timezone) {
  const value = row[groupDef.by];
  if (groupDef.granularity === 'day') return localDateKey(value, timezone);
  return String(value);
}

function findGroup(groupDefs, name) {
  const def = groupDefs.find((g) => g.name === name);
  if (!def) throw new Error(`Unknown group "${name}"`);
  return def;
}

function numeric(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// Hierarchical ordering by first appearance. A Map preserves insertion order,
// so group instances come out in the order their first row arrived — which is
// the order the source pipeline sorted by.
function orderRows(rows, groupDefs, timezone, depth = 0) {
  if (depth >= groupDefs.length) return rows;

  const buckets = new Map();
  for (const row of rows) {
    const key = groupKey(row, groupDefs[depth], timezone);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  const ordered = [];
  for (const bucket of buckets.values()) {
    ordered.push(...orderRows(bucket, groupDefs, timezone, depth + 1));
  }
  return ordered;
}

function samePrefix(a, b, depth) {
  for (let d = 0; d <= depth; d++) {
    if (a[d] !== b[d]) return false;
  }
  return true;
}

// Contiguous [start, end) ranges per depth. Safe because orderRows() has
// already made every group's rows contiguous.
function findInstances(keyPaths, depth) {
  const instances = [];
  if (keyPaths.length === 0) return instances;

  let start = 0;
  for (let i = 1; i <= keyPaths.length; i++) {
    const boundary = i === keyPaths.length || !samePrefix(keyPaths[i], keyPaths[start], depth);
    if (boundary) {
      instances.push({ start, end: i });
      start = i;
    }
  }
  return instances;
}

// `distinctBy` names another group: the aggregate then counts each instance of
// that group once, taking the value from its first row. This is what expresses
// "sum net amount once per order, not once per sub-order line".
function evaluateAggregate(rows, agg, groupDefs, timezone) {
  if (agg.fn === 'count') {
    if (!agg.distinctBy) return rows.length;
    const def = findGroup(groupDefs, agg.distinctBy);
    const seen = new Set();
    for (const row of rows) seen.add(groupKey(row, def, timezone));
    return seen.size;
  }

  // sum
  if (!agg.distinctBy) {
    let total = 0;
    for (const row of rows) total += numeric(row[agg.of]);
    return total;
  }

  const def = findGroup(groupDefs, agg.distinctBy);
  const seen = new Set();
  let total = 0;
  for (const row of rows) {
    const key = groupKey(row, def, timezone);
    if (seen.has(key)) continue;
    seen.add(key);
    total += numeric(row[agg.of]);
  }
  return total;
}

/**
 * @returns {{ rows: object[], spansByRow: object[] }}
 *   rows        — ordered, with group aggregates merged into each row
 *   spansByRow  — parallel array of { [groupName]: span }, where the first row
 *                 of a group carries its size and the rest carry 0
 */
function groupRows(rawRows, definition, timezone) {
  const groupDefs = definition.groups || [];
  const rows = groupDefs.length ? orderRows(rawRows, groupDefs, timezone) : rawRows.slice();

  const spansByRow = rows.map(() => ({}));
  if (groupDefs.length === 0) return { rows, spansByRow };

  const keyPaths = rows.map((row) => groupDefs.map((g) => groupKey(row, g, timezone)));

  groupDefs.forEach((groupDef, depth) => {
    for (const { start, end } of findInstances(keyPaths, depth)) {
      const size = end - start;
      for (let i = start; i < end; i += 1) {
        spansByRow[i][groupDef.name] = i === start ? size : 0;
      }

      for (const agg of groupDef.aggregates || []) {
        const value = evaluateAggregate(rows.slice(start, end), agg, groupDefs, timezone);
        // Written to every row in the group so the column can render from any
        // row; the span then decides which one is actually shown.
        for (let i = start; i < end; i += 1) rows[i][agg.key] = value;
      }
    }
  });

  return { rows, spansByRow };
}

module.exports = { groupRows, evaluateAggregate, localDateKey, groupKey };
