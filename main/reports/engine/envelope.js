// Assembles the ReportEnvelope — the single payload consumed by both the
// table and the exporter (§5 of REPORT_ENGINE_ARCHITECTURE.md).
//
// Values stay raw and typed; formatting is described, never applied. The
// server sends 1500 plus { format: 'fixed', decimals: 2 }, not "1500.00", so
// Excel receives real numbers instead of text.

const { evaluateAggregate } = require('./grouper.js');
const { resolveValueMap } = require('./valueMaps.js');
const { toArray } = require('./validateDefinition.js');

// Presentation fields copied verbatim to the client. `exportFormat` /
// `exportDecimals` / `exportLabel` exist only to preserve places where the old
// table and the old export deliberately disagreed; see MIGRATION-NOTES.md.
const COLUMN_PASSTHROUGH = [
  'key', 'label', 'type', 'align', 'format', 'decimals', 'pad',
  'zeroAs', 'emptyAs', 'suffix', 'emphasis',
  'exportLabel', 'exportFormat', 'exportDecimals', 'exportZeroAs',
];

function buildColumns(definition) {
  return definition.columns.map((column) => {
    const out = {};
    for (const field of COLUMN_PASSTHROUGH) {
      if (column[field] !== undefined) out[field] = column[field];
    }
    if (column.valueMap) out.valueMap = resolveValueMap(column.valueMap);
    return out;
  });
}

// Spans are computed per group but delivered per column: Daily Sales carries a
// date-level span on its *last* column while order-level spans sit on the
// first six, so a positional or strictly-nested model cannot express both
// reports. See §5 rule 1.
function buildRows(definition, rows, spansByRow) {
  const columns = definition.columns;

  return rows.map((row, index) => {
    const values = {};
    const spans = {};

    for (const column of columns) {
      values[column.key] = row[column.key] ?? null;
      if (column.span) {
        spans[column.key] = spansByRow[index][column.span] ?? 1;
      }
    }

    return { values, spans };
  });
}

function buildFooter(definition, rows, timezone) {
  const columnIndex = new Map(definition.columns.map((c, i) => [c.key, i]));

  return toArray(definition.footer).map((entry) => ({
    label: entry.label,
    column: entry.column,
    value: evaluateAggregate(rows, entry, definition.groups || [], timezone),
    // Derived, never authored — reproduces the hand-maintained colspan="11" /
    // "9" / "7" / "6" of the old templates.
    labelSpan: columnIndex.get(entry.column),
    format: entry.format,
    decimals: entry.decimals,
    suffix: entry.suffix,
    exportFormat: entry.exportFormat,
    exportDecimals: entry.exportDecimals,
    exportSuffix: entry.exportSuffix,
  }));
}

function buildEnvelope({ definition, rows, spansByRow, params, timezone, generatedAt }) {
  return {
    report: {
      id: definition.id,
      title: definition.title,
      exportTitle: definition.exportTitle || definition.title,
      exportBasename: definition.exportBasename || definition.id,
      sheetName: definition.sheetName || definition.title,
      orientation: definition.orientation || 'landscape',
      emptyMessage: definition.emptyMessage || 'No data found for the selected filters.',
      generatedAt,
      params,
    },
    columns: buildColumns(definition),
    rows: buildRows(definition, rows, spansByRow),
    footer: buildFooter(definition, rows, timezone),
    meta: { rowCount: rows.length },
  };
}

module.exports = { buildEnvelope };
