// A new order's delivery date must be today or later.
//
// The interesting part is the day boundary: the form sends 'YYYY-MM-DD' and
// Mongo stores that as UTC midnight, so anything that compares instants rather
// than calendar days gets "today" wrong for a shop that isn't on UTC. These run
// without a database.
//
// Run: node main/__tests__/order-delivery-date.test.js

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

const { toCalendarDay, todayCalendarDay, assertDeliveryDateNotPast } = require('../services/order.service');

function dayOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function expectRejected(value) {
  try {
    assertDeliveryDateNotPast(value);
  } catch (err) {
    assert.strictEqual(err.status, 422, `expected 422, got ${err.status}`);
    return err;
  }
  assert.fail(`expected ${JSON.stringify(value)} to be rejected`);
}

console.log('order delivery date');

test("today is accepted", () => {
  assertDeliveryDateNotPast(dayOffset(0));
});

test('a future date is accepted', () => {
  assertDeliveryDateNotPast(dayOffset(1));
  assertDeliveryDateNotPast(dayOffset(365));
});

test('yesterday is rejected', () => {
  const err = expectRejected(dayOffset(-1));
  assert.match(err.message, /cannot be in the past/i);
});

test('a long past date is rejected', () => {
  expectRejected('2020-01-01');
});

test('a missing date is rejected rather than treated as today', () => {
  expectRejected(undefined);
  expectRejected(null);
  expectRejected('');
});

test('an unparseable date is rejected', () => {
  expectRejected('not-a-date');
});

// The boundary the timezone gets wrong. At +05:30, today's date-only value
// parses to a UTC instant that is still "yesterday" in UTC terms — comparing
// instants would reject a perfectly valid same-day order.
test("today's date survives the UTC-midnight round trip", () => {
  const today = dayOffset(0);
  assert.strictEqual(toCalendarDay(today), today);
  assert.strictEqual(toCalendarDay(new Date(`${today}T00:00:00.000Z`)), today);
  assertDeliveryDateNotPast(new Date(`${today}T00:00:00.000Z`));
});

test('todayCalendarDay agrees with the local calendar', () => {
  assert.strictEqual(todayCalendarDay(), dayOffset(0));
});

test('a full timestamp on a future day is accepted', () => {
  assertDeliveryDateNotPast(`${dayOffset(2)}T18:30:00.000Z`);
});

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
