// Loads and caches report definitions from ../definitions/*.json.
//
// Definitions are trusted server-side files. Nothing here reads client input —
// a report id is looked up in the cache, never used to build a path.

const fs = require('fs');
const path = require('path');
const { validateDefinition } = require('./validateDefinition.js');

const DEFINITIONS_DIR = path.join(__dirname, '..', 'definitions');
const isProduction = process.env.NODE_ENV === 'production';

let cache = null;

function loadAll() {
  const files = fs.readdirSync(DEFINITIONS_DIR).filter((f) => f.endsWith('.json'));
  const byId = new Map();

  for (const file of files) {
    const fullPath = path.join(DEFINITIONS_DIR, file);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      throw new Error(`Could not parse report definition ${file}: ${err.message}`);
    }

    validateDefinition(parsed, file);

    if (byId.has(parsed.id)) {
      throw new Error(`Duplicate report id "${parsed.id}" (${file})`);
    }
    byId.set(parsed.id, Object.freeze(parsed));
  }

  return byId;
}

// In development definitions are re-read on every request so editing a JSON
// file takes effect without restarting Electron. In production they are read
// once at first use.
function getAll() {
  if (!cache || !isProduction) cache = loadAll();
  return cache;
}

function getDefinition(id) {
  const def = getAll().get(id);
  if (!def) {
    const err = new Error(`Unknown report "${id}"`);
    err.status = 404;
    throw err;
  }
  return def;
}

// Catalog entries drive the nav menu and the filter bar. `params` is included
// so opening a report needs no extra round trip — the client renders its
// filters from the catalog it already holds, then calls /api/reports/:id once
// the user hits Generate. Columns, groups and source details stay server-side.
function listDefinitions() {
  return [...getAll().values()]
    .map((def) => ({
      id: def.id,
      title: def.title,
      menuTitle: def.menuTitle || def.title,
      group: def.group || 'Reports',
      icon: def.icon || 'mdi-file-chart-outline',
      permission: def.permission || null,
      order: def.order ?? 100,
      emptyMessage: def.emptyMessage || 'No data found for the selected filters.',
      params: def.params || [],
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

module.exports = { getDefinition, listDefinitions };
