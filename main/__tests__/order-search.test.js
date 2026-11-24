// The order list's quick search finds one order by its exact number.
//
// Run: node main/__tests__/order-search.test.js

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

const { orderNoSearchFilter } = require('../services/order.service');

console.log('order search');

test('a number finds that order only, not every order containing the digit', () => {
  assert.deepStrictEqual(orderNoSearchFilter('2'), { orderNo: 2 });
  assert.deepStrictEqual(orderNoSearchFilter('21'), { orderNo: 21 });
});

test('the padded number shown in the list finds the same order', () => {
  assert.deepStrictEqual(orderNoSearchFilter('0002'), { orderNo: 2 });
  assert.deepStrictEqual(orderNoSearchFilter('  2 '), { orderNo: 2 });
});

test('an empty search filters nothing', () => {
  assert.deepStrictEqual(orderNoSearchFilter(''), {});
  assert.deepStrictEqual(orderNoSearchFilter('   '), {});
  assert.deepStrictEqual(orderNoSearchFilter(undefined), {});
});

test('text that is not a whole number matches no order', () => {
  for (const q of ['abc', '2a', '2.5', '-2', '.*']) {
    assert.deepStrictEqual(orderNoSearchFilter(q), { orderNo: { $in: [] } }, q);
  }
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
