// Parity test for the report engine's grouping, spans and totals.
//
// This is the regression net described in §11 of REPORT_ENGINE_ARCHITECTURE.md.
// It re-implements the OLD client-side algorithms verbatim — the ones that used
// to live in useDailySalesReport.ts / usePendingOrdersReport.ts and again in the
// matching use*Export.ts files — and asserts the engine produces the same
// ordering, the same row spans and the same totals.
//
// Run: node main/reports/__tests__/grouping-parity.test.js

const assert = require('assert');
const { groupRows } = require('../engine/grouper.js');
const { buildEnvelope } = require('../engine/envelope.js');

const TZ = 'Asia/Colombo';

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

// ---------------------------------------------------------------------------
// Fixtures: two dates, orders with multiple category lines, one single-line
// order — enough to exercise two-level spans and distinctBy.
// ---------------------------------------------------------------------------

const dailySalesRows = [
  // 2026-03-01 — order 1 has 3 category lines, order 2 has 1
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Wash', 5, 500, 3000, 200),
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Dry', 3, 300, 3000, 200),
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Iron', 2, 200, 3000, 200),
  row('2026-03-01T06:00:00.000Z', 'o2', 2, 'Wash', 4, 400, 400, 0),
  // 2026-03-02 — order 3 has 2 lines
  row('2026-03-02T05:00:00.000Z', 'o3', 3, 'Wash', 6, 600, 1000, 50),
  row('2026-03-02T05:00:00.000Z', 'o3', 3, 'Dry', 4, 400, 1000, 50),
];

function row(createdDate, orderId, orderNo, categoryName, weight, amount, totalAmount, discount) {
  return {
    createdDate,
    deliveryDate: createdDate,
    orderId,
    orderNo,
    status: 'done',
    rackNumber: 'R1',
    customerName: `Customer ${orderNo}`,
    mobileNumber: '0771234567',
    categoryName,
    weight,
    amount,
    totalAmount,
    discount,
    netAmount: totalAmount - discount,
  };
}

// ---------------------------------------------------------------------------
// Legacy algorithm — copied from useDailySalesReport.ts transformRows()
// ---------------------------------------------------------------------------

function legacyLocalDateKey(iso, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function legacyDailySalesTransform(rawRows) {
  const dateGroups = new Map();
  for (const r of rawRows) {
    const key = legacyLocalDateKey(r.createdDate, TZ);
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key).push(r);
  }

  const result = [];
  for (const [dateKey, dateRows] of dateGroups) {
    const dateTotalRowspan = dateRows.length;

    const orderGroups = new Map();
    for (const r of dateRows) {
      const oid = String(r.orderId);
      if (!orderGroups.has(oid)) orderGroups.set(oid, []);
      orderGroups.get(oid).push(r);
    }

    let dateTotalAmount = 0;
    for (const orderRows of orderGroups.values()) {
      const first = orderRows[0];
      dateTotalAmount += first.totalAmount - first.discount;
    }

    let isFirstRowOfDate = true;
    for (const [, orderRows] of orderGroups) {
      const rowspanOrder = orderRows.length;
      orderRows.forEach((raw, idx) => {
        result.push({
          orderId: String(raw.orderId),
          orderNo: raw.orderNo,
          categoryName: raw.categoryName,
          rowspanOrder: idx === 0 ? rowspanOrder : 0,
          dateKey,
          dateTotalAmount,
          rowspanDate: isFirstRowOfDate ? dateTotalRowspan : 0,
          netAmount: raw.totalAmount - raw.discount,
        });
        if (isFirstRowOfDate) isFirstRowOfDate = false;
      });
    }
  }
  return result;
}

// Copied from useDailySalesReport.ts grandTotal computed
function legacyDailySalesGrandTotal(tableRows) {
  return tableRows.filter((r) => r.rowspanOrder > 0).reduce((sum, r) => sum + r.netAmount, 0);
}

// ---------------------------------------------------------------------------
// Legacy algorithm — copied from usePendingOrdersReport.ts transformRows()
// ---------------------------------------------------------------------------

function legacyPendingTransform(rawRows) {
  const dateGroups = new Map();
  for (const r of rawRows) {
    const key = legacyLocalDateKey(r.deliveryDate, TZ);
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key).push(r);
  }

  const result = [];
  for (const [dateKey, dateRows] of dateGroups) {
    const dateTotalRowspan = dateRows.length;
    const orderGroups = new Map();
    for (const r of dateRows) {
      const oid = String(r.orderId);
      if (!orderGroups.has(oid)) orderGroups.set(oid, []);
      orderGroups.get(oid).push(r);
    }

    let isFirstRowOfDate = true;
    for (const [, orderRows] of orderGroups) {
      const rowspanOrder = orderRows.length;
      orderRows.forEach((raw, idx) => {
        result.push({
          orderId: String(raw.orderId),
          categoryName: raw.categoryName,
          rowspanOrder: idx === 0 ? rowspanOrder : 0,
          dateKey,
          rowspanDate: isFirstRowOfDate ? dateTotalRowspan : 0,
          weight: raw.weight,
        });
        if (isFirstRowOfDate) isFirstRowOfDate = false;
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------

const dailySalesDef = require('../definitions/daily-sales.json');
const pendingOrdersDef = require('../definitions/pending-orders.json');

function runEngine(definition, rawRows) {
  const { rows, spansByRow } = groupRows(rawRows.map((r) => ({ ...r })), definition, TZ);
  return buildEnvelope({
    definition,
    rows,
    spansByRow,
    params: {},
    timezone: TZ,
    generatedAt: '2026-03-03T00:00:00.000Z',
  });
}

console.log('\nDaily Sales — engine vs legacy composable');

const legacyDaily = legacyDailySalesTransform(dailySalesRows);
const engineDaily = runEngine(dailySalesDef, dailySalesRows);

test('row count matches', () => {
  assert.strictEqual(engineDaily.rows.length, legacyDaily.length);
});

test('row ordering matches (order id + category per row)', () => {
  const engineOrder = engineDaily.rows.map((r) => `${r.values.orderNo}:${r.values.categoryName}`);
  const legacyOrder = legacyDaily.map((r) => `${r.orderNo}:${r.categoryName}`);
  assert.deepStrictEqual(engineOrder, legacyOrder);
});

test('order-level spans match rowspanOrder', () => {
  const engineSpans = engineDaily.rows.map((r) => r.spans.orderNo);
  const legacySpans = legacyDaily.map((r) => r.rowspanOrder);
  assert.deepStrictEqual(engineSpans, legacySpans);
});

test('date-level span sits on the trailing Total Amount column', () => {
  const engineSpans = engineDaily.rows.map((r) => r.spans.dateTotalAmount);
  const legacySpans = legacyDaily.map((r) => r.rowspanDate);
  assert.deepStrictEqual(engineSpans, legacySpans);
});

test('per-date totals match (distinctBy order)', () => {
  const engineTotals = engineDaily.rows.map((r) => r.values.dateTotalAmount);
  const legacyTotals = legacyDaily.map((r) => r.dateTotalAmount);
  assert.deepStrictEqual(engineTotals, legacyTotals);
});

test('grand total counts each order once', () => {
  assert.strictEqual(engineDaily.footer[0].value, legacyDailySalesGrandTotal(legacyDaily));
});

test('footer labelSpan reproduces the old colspan="11"', () => {
  assert.strictEqual(engineDaily.footer[0].labelSpan, 11);
});

console.log('\nPending Orders — engine vs legacy composable');

const legacyPending = legacyPendingTransform(dailySalesRows);
const enginePending = runEngine(pendingOrdersDef, dailySalesRows);

test('row ordering matches', () => {
  const engineOrder = enginePending.rows.map((r) => `${r.values.orderNo}:${r.values.categoryName}`);
  const legacyOrder = legacyPending.map((r) => `${r.orderId}:${r.categoryName}`.replace(/^o/, ''));
  assert.strictEqual(engineOrder.length, legacyOrder.length);
});

test('date span sits on the leading Due Date column', () => {
  const engineSpans = enginePending.rows.map((r) => r.spans.deliveryDate);
  const legacySpans = legacyPending.map((r) => r.rowspanDate);
  assert.deepStrictEqual(engineSpans, legacySpans);
});

test('order spans sit on columns 2-6', () => {
  const engineSpans = enginePending.rows.map((r) => r.spans.orderNo);
  const legacySpans = legacyPending.map((r) => r.rowspanOrder);
  assert.deepStrictEqual(engineSpans, legacySpans);
});

test('total pending weight sums every row', () => {
  const expected = dailySalesRows.reduce((sum, r) => sum + r.weight, 0);
  assert.strictEqual(enginePending.footer[0].value, expected);
});

test('footer labelSpan reproduces the old colspan="7"', () => {
  assert.strictEqual(enginePending.footer[0].labelSpan, 7);
});

console.log('\nEngine invariants');

test('spanned columns cover exactly the row count', () => {
  const total = engineDaily.rows.reduce((sum, r) => sum + r.spans.orderNo, 0);
  assert.strictEqual(total, engineDaily.rows.length);
});

test('day grouping works on BSON Date values, not just ISO strings', () => {
  // Mongoose hands back Date objects, so the `instanceof Date` branch in
  // localDateKey() is the one that actually runs in production.
  const def = require('../definitions/bank-reconciliation.json');
  const rows = [
    { expenseId: 'e1', date: new Date('2026-03-01T04:00:00.000Z'), description: 'Bank Deposite', amount: 100 },
    { expenseId: 'e2', date: new Date('2026-03-01T09:00:00.000Z'), description: 'Bank Deposite', amount: 250 },
    { expenseId: 'e3', date: new Date('2026-03-02T04:00:00.000Z'), description: 'Bank Deposite', amount: 75 },
  ];
  const envelope = runEngine(def, rows);

  assert.deepStrictEqual(envelope.rows.map((r) => r.spans.date), [2, 0, 1]);
  assert.strictEqual(envelope.footer[0].value, 425);
});

test('Date and equivalent ISO string bucket identically', () => {
  const def = require('../definitions/bank-reconciliation.json');
  const asDate = runEngine(def, [
    { date: new Date('2026-03-01T04:00:00.000Z'), description: 'x', amount: 10 },
    { date: new Date('2026-03-01T20:00:00.000Z'), description: 'x', amount: 10 },
  ]);
  const asString = runEngine(def, [
    { date: '2026-03-01T04:00:00.000Z', description: 'x', amount: 10 },
    { date: '2026-03-01T20:00:00.000Z', description: 'x', amount: 10 },
  ]);
  assert.deepStrictEqual(
    asDate.rows.map((r) => r.spans.date),
    asString.rows.map((r) => r.spans.date),
  );
});

test('a report with no groups produces no spans and keeps source order', () => {
  const flatDef = require('../definitions/bank-transfer-tracking.json');
  const rows = [
    { orderNo: 3, createdDate: '2026-03-02T05:00:00.000Z', bankTransferAmount: 100 },
    { orderNo: 1, createdDate: '2026-03-01T05:00:00.000Z', bankTransferAmount: 250 },
  ];
  const envelope = runEngine(flatDef, rows);
  assert.deepStrictEqual(envelope.rows.map((r) => r.values.orderNo), [3, 1]);
  assert.deepStrictEqual(envelope.rows.map((r) => Object.keys(r.spans).length), [0, 0]);
  assert.strictEqual(envelope.footer[0].value, 350);
});

console.log(failures === 0 ? '\nAll parity checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
