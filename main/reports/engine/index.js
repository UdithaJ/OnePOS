// Report engine entry point.
//
// Pipeline (§7 of REPORT_ENGINE_ARCHITECTURE.md):
//   load definition → bind params → query → post-process
//     → group (spans + aggregates) → totals → envelope
//
// Steps 1, 2, 5, 6 and 7 are shared by every report; only the query and
// post-process steps are report-specific, and those live in processors/.

const path = require('path');
const { getDefinition, listDefinitions } = require('./definitionLoader.js');
const { bindParams } = require('./paramBinder.js');
const { groupRows } = require('./grouper.js');
const { buildEnvelope } = require('./envelope.js');

const processorCache = new Map();

function getProcessor(definition) {
  const name = definition.source && definition.source.processor;
  if (!name) return null;

  if (!processorCache.has(name)) {
    // `name` comes from a trusted definition file, never from request input.
    processorCache.set(name, require(path.join(__dirname, '..', 'processors', `${name}.js`)));
  }
  return processorCache.get(name);
}

async function runReport(id, query) {
  const definition = getDefinition(id);
  const { values: params, raw, timezone } = bindParams(definition, query);
  const processor = getProcessor(definition);

  if (!processor || typeof processor.buildPipeline !== 'function') {
    throw new Error(`Report "${id}" has no processor with buildPipeline()`);
  }

  const context = { params, timezone };
  const model = require(path.join(__dirname, '..', '..', 'models', `${definition.source.model}.js`));

  let rows = await model.aggregate(processor.buildPipeline(context));

  if (typeof processor.postProcess === 'function') {
    rows = processor.postProcess(rows, context);
  }

  const { rows: ordered, spansByRow } = groupRows(rows, definition, timezone);

  return buildEnvelope({
    definition,
    rows: ordered,
    spansByRow,
    params: raw,
    timezone,
    generatedAt: new Date().toISOString(),
  });
}

module.exports = { runReport, listDefinitions, getDefinition };
