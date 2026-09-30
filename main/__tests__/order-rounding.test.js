// Line item amounts are charged to the nearest 10, with the unrounded amount
// kept for reference, so the due amount on screen is always payable. These run
// without a database.
//
// Run: node main/__tests__/order-rounding.test.js

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

const { toCents, roundToTen } = require('../utils/money');
const { computeAmount } = require('../services/order.service');

console.log('order rounding');

test('rounds up to the nearest 10', () => {
  assert.strictEqual(roundToTen(1988.75), 1990);
});

test('rounds down to the nearest 10', () => {
  assert.strictEqual(roundToTen(1984.99), 1980);
});

test('a halfway value rounds up', () => {
  assert.strictEqual(roundToTen(1985), 1990);
});

test('float noise does not decide a boundary', () => {
  // 1.15 * 30 is 34.49999… in floating point; in cents it is 34.50.
  assert.strictEqual(toCents(1.15 * 30), 34.5);
  assert.strictEqual(roundToTen(1984.9999999), 1990);
  assert.strictEqual(roundToTen(1985 - 1e-9), 1990);
});

test('a line item is charged rounded and keeps its actual amount', () => {
  const { amount, actualAmount } = computeAmount(7.95, { unitPrice: 250.1572327, minimumPrice: 0 });
  assert.strictEqual(actualAmount, toCents(7.95 * 250.1572327));
  assert.strictEqual(amount, roundToTen(actualAmount));
  assert.strictEqual(amount % 10, 0);
});

test('the minimum price floor is applied before rounding', () => {
  assert.deepStrictEqual(computeAmount(1, { unitPrice: 100, minimumPrice: 245.5 }), { amount: 250, actualAmount: 245.5 });
});

test('no weight charges nothing', () => {
  assert.deepStrictEqual(computeAmount(0, { unitPrice: 100, minimumPrice: 300 }), { amount: 0, actualAmount: 0 });
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
