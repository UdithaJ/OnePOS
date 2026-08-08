// Loads every report definition, resolves its processor and model, and builds
// its aggregation pipeline. Catches a broken definition, a renamed processor or
// a missing model at test time rather than when a user opens the report.
//
// Run: node main/reports/__tests__/definitions.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { listDefinitions, getDefinition } = require('../engine/index.js');
const { bindParams } = require('../engine/paramBinder.js');
const { groupRows } = require('../engine/grouper.js');
const { buildEnvelope } = require('../engine/envelope.js');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

const catalog = listDefinitions();

console.log(`\nCatalog (${catalog.length} reports)`);

test('every definition file loads and validates', () => {
  const files = fs.readdirSync(path.join(__dirname, '..', 'definitions')).filter((f) => f.endsWith('.json'));
  assert.strictEqual(catalog.length, files.length);
});

test('catalog is ordered and complete', () => {
  const ids = catalog.map((entry) => entry.id);
  assert.deepStrictEqual(ids, [
    'daily-sales',
    'pending-orders',
    'bank-reconciliation',
    'expenses',
    'returning-customers',
    'cash-box-summary',
    'bank-transfer-tracking',
  ]);
  for (const entry of catalog) {
    assert.ok(entry.menuTitle, `${entry.id} has no menuTitle`);
    assert.ok(entry.icon, `${entry.id} has no icon`);
    assert.ok(Array.isArray(entry.params), `${entry.id} has no params array`);
  }
});

console.log('\nPer report');

const SAMPLE_QUERY = {
  fromDate: '2026-03-01T00:00:00.000Z',
  toDate: '2026-03-31T23:59:59.999Z',
  status: 'all',
  expenseTypeId: 'all',
  minOrderCount: '1',
  tz: 'Asia/Colombo',
};

for (const entry of catalog) {
  const definition = getDefinition(entry.id);

  test(`${entry.id}: model file exists`, () => {
    const modelPath = path.join(__dirname, '..', '..', 'models', `${definition.source.model}.js`);
    assert.ok(fs.existsSync(modelPath), `missing model ${modelPath}`);
  });

  test(`${entry.id}: processor builds a pipeline`, () => {
    const processor = require(path.join(__dirname, '..', 'processors', `${definition.source.processor}.js`));
    assert.strictEqual(typeof processor.buildPipeline, 'function');

    const { values, timezone } = bindParams(definition, SAMPLE_QUERY);
    const pipeline = processor.buildPipeline({ params: values, timezone });
    assert.ok(Array.isArray(pipeline) && pipeline.length > 0, 'pipeline is empty');
  });

  test(`${entry.id}: builds an envelope from zero rows`, () => {
    const { values, raw, timezone } = bindParams(definition, SAMPLE_QUERY);
    const { rows, spansByRow } = groupRows([], definition, timezone);
    const envelope = buildEnvelope({
      definition, rows, spansByRow, params: raw, timezone,
      generatedAt: '2026-03-03T00:00:00.000Z',
    });

    assert.strictEqual(envelope.rows.length, 0);
    assert.strictEqual(envelope.columns.length, definition.columns.length);
    assert.ok(envelope.report.title);
    assert.ok(values);
  });

  test(`${entry.id}: every footer targets a real column`, () => {
    const keys = new Set(definition.columns.map((c) => c.key));
    const footers = definition.footer ? [].concat(definition.footer) : [];
    for (const entry2 of footers) assert.ok(keys.has(entry2.column));
  });
}

console.log('\nParameter binding');

test('a missing required param is a 400, not a 500', () => {
  const definition = getDefinition('daily-sales');
  try {
    bindParams(definition, { tz: 'UTC' });
    assert.fail('expected an error');
  } catch (err) {
    assert.strictEqual(err.status, 400);
  }
});

test('undeclared query params are dropped', () => {
  const definition = getDefinition('daily-sales');
  const { values } = bindParams(definition, { ...SAMPLE_QUERY, sneaky: 'value' });
  assert.deepStrictEqual(Object.keys(values).sort(), ['fromDate', 'toDate']);
});

test('an unparseable date is rejected', () => {
  const definition = getDefinition('daily-sales');
  try {
    bindParams(definition, { fromDate: 'not-a-date', toDate: SAMPLE_QUERY.toDate });
    assert.fail('expected an error');
  } catch (err) {
    assert.strictEqual(err.status, 400);
  }
});

test('an unknown report id is a 404', () => {
  try {
    getDefinition('no-such-report');
    assert.fail('expected an error');
  } catch (err) {
    assert.strictEqual(err.status, 404);
  }
});

console.log(failures === 0 ? '\nAll definition checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
