// The live balance and the closing amount share one formula, so a session
// showing a balance closes at that same balance. These run without a database.
//
// Run: node main/__tests__/cash-box-balance.test.js

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

const { computeSessionBalance } = require('../services/cashBoxSession.service');

console.log('cash box balance');

test('cash inflows count towards the balance', () => {
  // Opening 0, a 5,000 inflow and a 5,000 expense leaves nothing in the box.
  assert.strictEqual(computeSessionBalance(0, { totalInflows: 5000, totalExpenses: 5000 }), 0);
});

test('every ledger movement is applied', () => {
  const totals = { totalPayments: 1000, totalDeposits: 200, totalInflows: 300, totalExpenses: 400, totalWithdrawals: 50 };
  assert.strictEqual(computeSessionBalance(500, totals), 1550);
});

test('missing totals count as zero', () => {
  assert.strictEqual(computeSessionBalance(undefined, {}), 0);
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
