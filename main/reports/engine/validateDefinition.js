// Structural validation for report definitions.
//
// Hand-rolled rather than JSON-Schema-via-ajv so the engine adds no runtime
// dependency. `../schema/report.schema.json` remains the authored contract and
// the source for the frontend's TypeScript types; this file enforces the parts
// that would otherwise fail confusingly deep inside the engine.
//
// Definitions are trusted, developer-authored files, so the goal is a clear
// error at load time — not defence against hostile input.

const PARAM_TYPES = ['date', 'number', 'text', 'select'];
const COLUMN_TYPES = ['text', 'number', 'date', 'badge'];
const NUMBER_FORMATS = ['fixed', 'grouped', 'plain'];
const AGG_FNS = ['sum', 'count'];

function fail(id, message) {
  throw new Error(`Invalid report definition "${id}": ${message}`);
}

function validateDefinition(def, sourceFile) {
  const id = def && def.id ? def.id : sourceFile;

  if (!def || typeof def !== 'object') fail(id, 'not an object');
  if (!def.id) fail(id, 'missing "id"');
  if (!def.title) fail(id, 'missing "title"');
  if (!Array.isArray(def.columns) || def.columns.length === 0) {
    fail(id, 'missing or empty "columns"');
  }

  // Names are collected before any aggregate is checked: an outer group's
  // aggregate legitimately references an inner group declared after it
  // (Daily Sales' date total is distinctBy "order").
  const groupNames = new Set();
  for (const group of def.groups || []) {
    if (!group.name) fail(id, 'group missing "name"');
    if (!group.by) fail(id, `group "${group.name}" missing "by"`);
    if (groupNames.has(group.name)) fail(id, `duplicate group "${group.name}"`);
    groupNames.add(group.name);
  }

  for (const group of def.groups || []) {
    for (const agg of group.aggregates || []) {
      validateAggregate(id, agg, groupNames, `group "${group.name}"`);
    }
  }

  for (const param of def.params || []) {
    if (!param.name) fail(id, 'param missing "name"');
    if (!PARAM_TYPES.includes(param.type)) {
      fail(id, `param "${param.name}" has unknown type "${param.type}"`);
    }
    if (param.type === 'select' && !param.options && !param.optionsFrom) {
      fail(id, `select param "${param.name}" needs "options" or "optionsFrom"`);
    }
  }

  const columnKeys = new Set();
  for (const column of def.columns) {
    if (!column.key) fail(id, 'column missing "key"');
    if (columnKeys.has(column.key)) fail(id, `duplicate column "${column.key}"`);
    columnKeys.add(column.key);

    if (!COLUMN_TYPES.includes(column.type)) {
      fail(id, `column "${column.key}" has unknown type "${column.type}"`);
    }
    if (column.span && !groupNames.has(column.span)) {
      fail(id, `column "${column.key}" spans undeclared group "${column.span}"`);
    }
    if (column.format && !NUMBER_FORMATS.includes(column.format)) {
      fail(id, `column "${column.key}" has unknown format "${column.format}"`);
    }
    if (column.exportFormat && !NUMBER_FORMATS.includes(column.exportFormat)) {
      fail(id, `column "${column.key}" has unknown exportFormat "${column.exportFormat}"`);
    }
  }

  for (const entry of toArray(def.footer)) {
    if (!entry.column) fail(id, 'footer entry missing "column"');
    if (!columnKeys.has(entry.column)) {
      fail(id, `footer targets unknown column "${entry.column}"`);
    }
    validateAggregate(id, entry, groupNames, 'footer');
  }

  return def;
}

function validateAggregate(id, agg, groupNames, where) {
  if (!AGG_FNS.includes(agg.fn)) {
    fail(id, `${where} has unknown aggregate fn "${agg.fn}"`);
  }
  if (agg.fn === 'sum' && !agg.of) {
    fail(id, `${where} sum aggregate missing "of"`);
  }
  if (agg.distinctBy && !groupNames.has(agg.distinctBy)) {
    fail(id, `${where} has distinctBy "${agg.distinctBy}" which is not a declared group`);
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { validateDefinition, toArray };
