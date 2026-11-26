// A cash inflow must carry a bill number or remark; expenses need not.
//
// Run: node main/__tests__/cash-inflow-remarks.test.js

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

const { remarksError } = require('../controllers/expense.controller');

console.log('cash inflow remarks');

test('an inflow without remarks is refused', () => {
  assert.strictEqual(remarksError({ flowType: 'inflow' }), 'Bill number or Remarks required');
  assert.strictEqual(remarksError({ flowType: 'inflow', remarks: '' }), 'Bill number or Remarks required');
});

test('remarks of only spaces do not count', () => {
  assert.strictEqual(remarksError({ flowType: 'inflow', remarks: '   ' }), 'Bill number or Remarks required');
});

test('an inflow with remarks is accepted', () => {
  assert.strictEqual(remarksError({ flowType: 'inflow', remarks: 'Bill 0457' }), null);
});

test('an expense does not need remarks', () => {
  assert.strictEqual(remarksError({ flowType: 'outflow' }), null);
  assert.strictEqual(remarksError({}), null);
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
