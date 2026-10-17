// Bulk customer import: the CSV reader and the row checks that decide whether a
// file is imported at all.
//
// Pure validation, so it runs without a database.
//
// Run: node main/__tests__/customer-import.test.js

const assert = require('assert');
const { parseCsv } = require('../utils/csv');
const { validateCustomerCsv, MAX_ROWS } = require('../services/customerImport.service');

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

const HEADER = 'Title,First Name,Last Name,Mobile Number,Address Line 1,Address Line 2,City,State,Postal Code';

function csv(...lines) {
  return [HEADER, ...lines].join('\r\n');
}

function expectRejected(text, matching) {
  try {
    validateCustomerCsv(text);
  } catch (err) {
    assert.strictEqual(err.status, 422, `expected 422, got ${err.status}`);
    if (matching) assert.match(err.message, matching, `message was: ${err.message}`);
    return;
  }
  assert.fail('expected the file to be rejected, but it was accepted');
}

console.log('csv reader');

test('quoted fields keep commas, doubled quotes and line breaks', () => {
  const records = parseCsv('a,"b, c","say ""hi""","two\nlines"\nx,y,z,w');
  assert.deepStrictEqual(records, [
    ['a', 'b, c', 'say "hi"', 'two\nlines'],
    ['x', 'y', 'z', 'w'],
  ]);
});

test('CRLF line endings and the Excel byte order mark are handled', () => {
  assert.deepStrictEqual(parseCsv('﻿a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);
});

test('an unclosed quote is reported', () => {
  assert.throws(() => parseCsv('a,"b\nc'), /closing "/);
});

console.log('customer rows');

test('a clean file is valid, with addresses kept', () => {
  const result = validateCustomerCsv(csv(
    'Mr,Sam,Silva,0771234567,"12, Main St",,Colombo,Western,00100',
    'Ms,Jane,,0719876543,,,,,',
  ));
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.rows[0].addressLine1, '12, Main St');
  assert.strictEqual(result.rows[0].line, 2);
});

test('only the required columns need to be present, in any order', () => {
  const result = validateCustomerCsv('mobile,first_name,TITLE\n0771234567,Sam,mr');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.rows[0].firstName, 'Sam');
  assert.strictEqual(result.rows[0].city, '');
});

test('titles are matched ignoring case and a trailing dot', () => {
  const result = validateCustomerCsv(csv('MR.,Sam,,0771234567', 'ms,Jane,,0719876543'));
  assert.strictEqual(result.rows[0].title, 'Mr');
  assert.strictEqual(result.rows[1].title, 'Ms');
});

test('an unknown title is refused', () => {
  const result = validateCustomerCsv(csv('Dr,Sam,,0771234567'));
  assert.match(result.rows[0].errors.join(), /Title "Dr" is not valid/);
});

test('spaces and dashes in mobile numbers are removed', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,077 123-4567'));
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.rows[0].mobileNumber, '0771234567');
});

test('a mobile number that lost its leading 0 says so', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,771234567'));
  assert.match(result.rows[0].errors.join(), /exactly 10 digits.*leading 0/);
});

test('a mobile number with letters is refused', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,07712345ab'));
  assert.match(result.rows[0].errors.join(), /exactly 10 digits/);
});

test('every problem on a row is reported, not just the first', () => {
  const result = validateCustomerCsv(csv(',,Silva,'));
  const errors = result.rows[0].errors.join(' | ');
  assert.match(errors, /Title is required/);
  assert.match(errors, /First Name is required/);
  assert.match(errors, /Mobile Number is required/);
});

test('mobile numbers already registered are refused', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,0771234567'), ['0771234567']);
  assert.match(result.rows[0].errors.join(), /already registered/);
});

test('a mobile number repeated in the file points at the earlier line', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,0771234567', 'Ms,Jane,,077 123 4567'));
  assert.strictEqual(result.rows[0].errors.length, 0);
  assert.match(result.rows[1].errors.join(), /also on line 2/);
  assert.strictEqual(result.invalid, 1);
});

test('blank lines are skipped and line numbers still match the file', () => {
  const result = validateCustomerCsv(csv('Mr,Sam,,0771234567', '', ',,,,,,,,', 'Ms,Jane,,0719876543', ''));
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.rows[1].line, 5);
});

test('values are trimmed', () => {
  const result = validateCustomerCsv(csv(' Mr ,  Sam , Silva , 0771234567 '));
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.rows[0].firstName, 'Sam');
});

console.log('files that are refused outright');

test('an empty file', () => expectRejected('  \n', /empty/));
test('a header with no rows', () => expectRejected(HEADER + '\n\n', /no customers/));
test('missing required columns are named', () => expectRejected('First Name,City\nSam,Colombo', /Missing: Title, Mobile Number/));
test(`more than ${MAX_ROWS} rows`, () => {
  const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Mr,A,,07${String(i).padStart(8, '0')}`);
  expectRejected(csv(...rows), /at most/);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall passed');
