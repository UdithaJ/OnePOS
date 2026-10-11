// An order needs at least one item, each with a known category and a weight
// above zero. These run without a database.
//
// Run: node main/__tests__/order-items.test.js

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

const { assertValidItems } = require('../services/order.service');

const CAT = '6ab8a4e936355ca60b659230';
const catMap = new Map([[CAT, { unitPrice: 100, minimumPrice: 0 }]]);

function rejects(suborders, message) {
  try {
    assertValidItems(suborders, catMap);
  } catch (err) {
    assert.strictEqual(err.status, 422);
    assert.ok(err.message.includes(message), err.message);
    return;
  }
  assert.fail('expected the items to be rejected');
}

console.log('order items');

test('an order with no items is rejected', () => {
  for (const suborders of [[], undefined, null, 'x']) rejects(suborders, 'at least one item');
});

test('an item without a category is rejected', () => {
  rejects([{ weight: 2 }], 'Item 1: a category is required');
  rejects([{ category: '', weight: 2 }], 'Item 1: a category is required');
});

test('an item with an unknown category is rejected', () => {
  rejects([{ category: '6ab8a4e936355ca60b659299', weight: 2 }], 'Item 1: the category was not found');
});

test('a zero, negative, blank or non-numeric weight is rejected', () => {
  for (const weight of [0, '0', -1, '-0.5', '', '  ', null, undefined, 'abc', Infinity]) {
    rejects([{ category: CAT, weight }], 'Item 1: the weight must be greater than 0');
  }
});

test('the failing item is named', () => {
  rejects([{ category: CAT, weight: 2 }, { category: CAT, weight: 0 }], 'Item 2:');
});

test('complete items pass', () => {
  assertValidItems([{ category: CAT, weight: 2 }, { category: CAT, weight: '0.25' }], catMap);
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('all passed');
