// Dashboard figures are worked out by aggregation pipelines. These check the
// parts that decide which orders count — the day window and each pipeline's
// match — without a database.
//
// Run: node main/__tests__/dashboard.test.js

const assert = require('assert');

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

const {
  resolveDayWindow,
  pendingPipeline,
  weightByCategoryPipeline,
  shapeSummary,
  resolveMonths,
  monthKeys,
  monthlyCountPipeline,
  fillMonths,
  deliveryPendingPipeline,
} = require('../services/dashboard.service');

console.log('dashboard');

test("the client's day window is used as sent", () => {
  // Midnight to midnight at +05:30, as the browser sends it.
  const { start, end } = resolveDayWindow('2026-09-26T18:30:00.000Z', '2026-09-27T18:29:59.999Z');
  assert.strictEqual(start.toISOString(), '2026-09-26T18:30:00.000Z');
  assert.strictEqual(end.toISOString(), '2026-09-27T18:29:59.999Z');
});

test("without a window, today is the server's local day", () => {
  const now = new Date(2026, 8, 27, 15, 45);
  const { start, end } = resolveDayWindow(undefined, undefined, now);
  assert.deepStrictEqual(start, new Date(2026, 8, 27, 0, 0, 0, 0));
  assert.deepStrictEqual(end, new Date(2026, 8, 27, 23, 59, 59, 999));
});

test('an unusable window falls back to the local day', () => {
  const now = new Date(2026, 8, 27, 9, 0);
  const fallback = resolveDayWindow(undefined, undefined, now);
  assert.deepStrictEqual(resolveDayWindow('not a date', 'nope', now), fallback);
  // start after end
  assert.deepStrictEqual(
    resolveDayWindow('2026-09-28T00:00:00Z', '2026-09-27T00:00:00Z', now),
    fallback
  );
});

test('pending counts todo orders only', () => {
  assert.deepStrictEqual(pendingPipeline()[0], { $match: { status: 'todo' } });
});

test("today's weight is limited to orders created inside the window", () => {
  const window = { start: new Date('2026-09-26T18:30:00Z'), end: new Date('2026-09-27T18:29:59.999Z') };
  assert.deepStrictEqual(weightByCategoryPipeline(window)[0], {
    $match: { createdDate: { $gte: window.start, $lte: window.end } },
  });
});

test('summed weights are rounded to 2 decimals', () => {
  const summary = shapeSummary({
    doneCount: 1,
    ordersTodayCount: 2,
    pending: [{ count: 1, weightKg: 2.3 + 5.14 }], // 7.4399999999999995
    byCategory: [{ _id: 'Bed Sheets & Towels', weightKg: 0.1 + 0.2 }],
  });
  assert.strictEqual(summary.pendingWeightKg, 7.44);
  assert.deepStrictEqual(summary.todayWeightByCategory, [{ category: 'Bed Sheets & Towels', weightKg: 0.3 }]);
});

test('no pending orders gives zero counts', () => {
  const summary = shapeSummary({ doneCount: 0, ordersTodayCount: 0, pending: [], byCategory: [] });
  assert.strictEqual(summary.pendingCount, 0);
  assert.strictEqual(summary.pendingWeightKg, 0);
});

test('the monthly chart offers 3, 6 or 12 months and defaults to 12', () => {
  assert.strictEqual(resolveMonths('3'), 3);
  assert.strictEqual(resolveMonths(6), 6);
  assert.strictEqual(resolveMonths('12'), 12);
  assert.strictEqual(resolveMonths(undefined), 12);
  assert.strictEqual(resolveMonths('24'), 12);
  assert.strictEqual(resolveMonths('abc'), 12);
});

test('the window ends with the current month, oldest first', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  assert.deepStrictEqual(monthKeys(3, 'Asia/Colombo', now), ['2026-07', '2026-08', '2026-09']);
  const twelve = monthKeys(12, 'Asia/Colombo', now);
  assert.strictEqual(twelve.length, 12);
  assert.strictEqual(twelve[0], '2025-10');
  assert.strictEqual(twelve[11], '2026-09');
});

test('the window crosses a year boundary', () => {
  const now = new Date('2026-01-15T10:00:00Z');
  assert.deepStrictEqual(monthKeys(3, 'Asia/Colombo', now), ['2025-11', '2025-12', '2026-01']);
});

test("the current month is the shop's, not UTC's", () => {
  // 20:00 UTC on 31 Aug is already 1 Sep at +05:30.
  const now = new Date('2026-08-31T20:00:00Z');
  assert.deepStrictEqual(monthKeys(3, 'Asia/Colombo', now), ['2026-07', '2026-08', '2026-09']);
  assert.deepStrictEqual(monthKeys(3, 'UTC', now), ['2026-06', '2026-07', '2026-08']);
});

test('monthly counts leave out cancelled orders and start at the first month', () => {
  const [match, group] = monthlyCountPipeline('Asia/Colombo', '2025-10');
  assert.deepStrictEqual(match.$match.status, { $ne: 'cancelled' });
  assert.deepStrictEqual(match.$match.$expr, {
    $gte: ['$createdDate', { $dateFromParts: { year: 2025, month: 10, day: 1, timezone: 'Asia/Colombo' } }],
  });
  assert.deepStrictEqual(group.$group._id, {
    $dateToString: { format: '%Y-%m', date: '$createdDate', timezone: 'Asia/Colombo' },
  });
});

test('months with no orders are plotted as zero', () => {
  const keys = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const rows = [{ _id: '2026-04', count: 7 }, { _id: '2026-01', count: 5 }];
  assert.deepStrictEqual(fillMonths(keys, rows), [
    { month: '2026-01', count: 5 },
    { month: '2026-02', count: 0 },
    { month: '2026-03', count: 0 },
    { month: '2026-04', count: 7 },
  ]);
});

test('delivery pending is done and paid orders, newest first', () => {
  const [match, sort] = deliveryPendingPipeline();
  assert.deepStrictEqual(match, { $match: { status: 'done', paymentStatus: 'paid' } });
  assert.deepStrictEqual(sort, { $sort: { orderNo: -1 } });
});

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
