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
  assert.deepStrictEqual(Object.keys(values).sort(), ['fromDate', 'paymentStatus', 'toDate']);
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

console.log('\nDaily Sales payment status filter');

function dailySalesMatch(query) {
  const definition = getDefinition('daily-sales');
  const processor = require(path.join(__dirname, '..', 'processors', 'daily-sales.js'));
  const { values, timezone } = bindParams(definition, { ...SAMPLE_QUERY, ...query });
  return processor.buildPipeline({ params: values, timezone })[0].$match;
}

test('"all" and an absent paymentStatus do not filter', () => {
  assert.ok(!('paymentStatus' in dailySalesMatch({ paymentStatus: 'all' })));
  assert.ok(!('paymentStatus' in dailySalesMatch({ paymentStatus: undefined })));
});

test('paid / partial match their own value', () => {
  assert.strictEqual(dailySalesMatch({ paymentStatus: 'paid' }).paymentStatus, 'paid');
  assert.strictEqual(dailySalesMatch({ paymentStatus: 'partial' }).paymentStatus, 'partial');
});

test('"unpaid" also matches orders with no paymentStatus field', () => {
  assert.deepStrictEqual(dailySalesMatch({ paymentStatus: 'unpaid' }).paymentStatus, { $in: ['unpaid', null] });
});

test('an unknown paymentStatus is a 400, not an empty report', () => {
  try {
    dailySalesMatch({ paymentStatus: 'refunded' });
    assert.fail('expected an error');
  } catch (err) {
    assert.strictEqual(err.status, 400);
  }
});

console.log('\nCash report periods (transaction date vs business day)');

const CASH_REPORTS = ['cash-box-summary', 'expenses', 'bank-reconciliation'];

function cashPipeline(id, query) {
  const definition = getDefinition(id);
  const processor = require(path.join(__dirname, '..', 'processors', `${definition.source.processor}.js`));
  const { values, timezone } = bindParams(definition, { ...SAMPLE_QUERY, ...query });
  return { values, pipeline: processor.buildPipeline({ params: values, timezone }) };
}
const matches = (pipeline) => pipeline.filter((stage) => stage.$match).map((stage) => stage.$match);
const lookupsFrom = (pipeline) => pipeline.filter((stage) => stage.$lookup).map((stage) => stage.$lookup.from);

test('cash box summary reads payments and excludes bank payments', () => {
  assert.strictEqual(getDefinition('cash-box-summary').source.model, 'payment');
  const { pipeline } = cashPipeline('cash-box-summary', {});
  assert.ok(matches(pipeline).some((m) => JSON.stringify(m.paymentMethod) === JSON.stringify({ $ne: 'bank' })));
  assert.ok(!matches(pipeline).some((m) => 'createdDate' in m), 'must not filter on the order creation date');
});

for (const id of CASH_REPORTS) {
  test(`${id}: transaction basis (and absent) filters on the transaction's own date`, () => {
    for (const query of [{ dateBasis: 'transaction' }, { dateBasis: undefined }]) {
      const { values, pipeline } = cashPipeline(id, query);
      assert.ok(matches(pipeline).some((m) => JSON.stringify(m.date) === JSON.stringify({ $gte: values.fromDate, $lte: values.toDate })));
      assert.ok(!lookupsFrom(pipeline).includes('cashboxsessions'));
    }
  });

  test(`${id}: business basis filters on the session's opening day`, () => {
    const { values, pipeline } = cashPipeline(id, { dateBasis: 'business' });
    assert.ok(lookupsFrom(pipeline).includes('cashledgers') && lookupsFrom(pipeline).includes('cashboxsessions'));
    // The transaction's own date may run past toDate (after midnight), so it
    // is only bounded below; the full period applies to the business date.
    assert.ok(matches(pipeline).some((m) => JSON.stringify(m.date) === JSON.stringify({ $gte: values.fromDate })));
    assert.ok(matches(pipeline).some((m) => JSON.stringify(m.businessDate) === JSON.stringify({ $gte: values.fromDate, $lte: values.toDate })));
  });

  test(`${id}: an unknown dateBasis is a 400`, () => {
    try {
      cashPipeline(id, { dateBasis: 'fiscal' });
      assert.fail('expected an error');
    } catch (err) {
      assert.strictEqual(err.status, 400);
    }
  });
}

test('expenses and bank reconciliation group by the business date in business mode', () => {
  for (const id of ['expenses', 'bank-reconciliation']) {
    const project = cashPipeline(id, { dateBasis: 'business' }).pipeline.find((stage) => stage.$project).$project;
    assert.strictEqual(project.date, '$businessDate', id);
  }
});

test('bank transfer tracking: order basis (and absent) filters on the order creation date', () => {
  for (const query of [{ dateBasis: 'order' }, { dateBasis: undefined }]) {
    const { values, pipeline } = cashPipeline('bank-transfer-tracking', query);
    assert.ok(matches(pipeline).some((m) => JSON.stringify(m['order.createdDate']) === JSON.stringify({ $gte: values.fromDate, $lte: values.toDate })));
    assert.ok(!matches(pipeline).some((m) => 'date' in m), 'must not filter on the payment date');
  }
});

test('bank transfer tracking: payment basis filters on the payment date', () => {
  const { values, pipeline } = cashPipeline('bank-transfer-tracking', { dateBasis: 'payment' });
  assert.ok(matches(pipeline).some((m) => JSON.stringify(m.date) === JSON.stringify({ $gte: values.fromDate, $lte: values.toDate })));
  assert.ok(!matches(pipeline).some((m) => 'order.createdDate' in m));
  assert.ok(!lookupsFrom(pipeline).includes('cashboxsessions'));
});

test('bank transfer tracking: business basis filters on the session opening day', () => {
  const { values, pipeline } = cashPipeline('bank-transfer-tracking', { dateBasis: 'business' });
  assert.ok(lookupsFrom(pipeline).includes('cashledgers') && lookupsFrom(pipeline).includes('cashboxsessions'));
  assert.ok(matches(pipeline).some((m) => JSON.stringify(m.businessDate) === JSON.stringify({ $gte: values.fromDate, $lte: values.toDate })));
});

test('bank transfer tracking: only bank payments, and an unknown dateBasis is a 400', () => {
  const { pipeline } = cashPipeline('bank-transfer-tracking', {});
  assert.ok(matches(pipeline).some((m) => m.paymentMethod === 'bank'));
  try {
    cashPipeline('bank-transfer-tracking', { dateBasis: 'transaction' });
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
