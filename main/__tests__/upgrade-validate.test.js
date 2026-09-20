// An upgrade script is data, not code. This suite is the boundary that keeps
// that true: it checks the shapes that are accepted, and — more importantly —
// the ones that must be refused before anything reaches the database.
//
// Pure validation, so it runs without a database.
//
// Run: node main/__tests__/upgrade-validate.test.js

const assert = require('assert');
const { validateScript, FORBIDDEN_OPERATORS } = require('../upgrades/validate');

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

function script(operations, extra = {}) {
  return { action: 'upgrade:test', version: 1, operations, ...extra };
}

function expectRejected(input, matching) {
  try {
    validateScript(input);
  } catch (err) {
    assert.strictEqual(err.status, 422, `expected 422, got ${err.status}`);
    if (matching) assert.match(err.message, matching, `message was: ${err.message}`);
    return err;
  }
  assert.fail('expected the script to be rejected, but it was accepted');
}

console.log('upgrade script validation');

// --- shapes that are accepted ------------------------------------------------

test('a well formed update script is accepted', () => {
  const s = validateScript(script([
    {
      op: 'updateOne',
      collection: 'workflowStateMachine',
      filter: { entity: 'order', from: 'todo', to: 'cancelled' },
      update: { $set: { roles: ['admin', 'cashier'] } },
    },
  ]));
  assert.strictEqual(s.action, 'upgrade:test');
  assert.strictEqual(s.version, 1);
});

test('inserts and deletes are accepted', () => {
  validateScript(script([
    { op: 'insertMany', collection: 'categories', documents: [{ name: 'A' }, { name: 'B' }] },
    { op: 'insertOne', collection: 'categories', document: { name: 'C' } },
    { op: 'deleteMany', collection: 'categories', filter: { name: 'A' } },
  ]));
});

test('version defaults to 1 when omitted', () => {
  const s = validateScript({
    action: 'upgrade:x',
    operations: [{ op: 'deleteOne', collection: 'categories', filter: { name: 'A' } }],
  });
  assert.strictEqual(s.version, 1);
});

// --- the security boundary ---------------------------------------------------

test('every code-executing operator is refused, wherever it appears', () => {
  for (const operator of FORBIDDEN_OPERATORS) {
    expectRejected(
      script([{ op: 'deleteMany', collection: 'orders', filter: { [operator]: 'anything' } }]),
      new RegExp(operator.replace('$', '\\$')),
    );
  }
});

test('a code-executing operator nested deep inside a filter is still found', () => {
  expectRejected(
    script([{
      op: 'updateMany',
      collection: 'orders',
      filter: { $and: [{ status: 'todo' }, { $or: [{ $where: 'this.x === 1' }] }] },
      update: { $set: { status: 'done' } },
    }]),
    /\$where/,
  );
});

test('a code-executing operator inside an inserted document is refused', () => {
  expectRejected(
    script([{ op: 'insertOne', collection: 'categories', document: { name: 'x', $function: {} } }]),
    /\$function/,
  );
});

test('an unsupported op is refused', () => {
  expectRejected(script([{ op: 'aggregate', collection: 'orders', pipeline: [] }]), /unsupported op/i);
  expectRejected(script([{ op: 'drop', collection: 'orders' }]), /unsupported op/i);
});

test("mongo's internal collections are off limits", () => {
  expectRejected(
    script([{ op: 'deleteMany', collection: 'system.indexes', filter: { a: 1 } }]),
    /internal collection/i,
  );
});

test('a collection name that is not a plain name is refused', () => {
  expectRejected(script([{ op: 'deleteOne', collection: '../etc/passwd', filter: { a: 1 } }]), /invalid collection/i);
  expectRejected(script([{ op: 'deleteOne', collection: '', filter: { a: 1 } }]), /must name a collection/i);
});

// --- the mistakes that destroy data -----------------------------------------

test('an empty filter is refused unless it is stated explicitly', () => {
  expectRejected(
    script([{ op: 'deleteMany', collection: 'orders', filter: {} }]),
    /matches every document/i,
  );
  // Same operation, deliberately confirmed.
  validateScript(script([{ op: 'deleteMany', collection: 'orders', filter: {}, confirmAll: true }]));
});

test('an update that would replace the whole document is refused', () => {
  expectRejected(
    script([{ op: 'updateOne', collection: 'categories', filter: { name: 'A' }, update: { name: 'B' } }]),
    /replaces the entire document/i,
  );
});

test('a delete or update with no filter at all is refused', () => {
  expectRejected(script([{ op: 'deleteMany', collection: 'orders' }]), /needs a "filter"/i);
  expectRejected(script([{ op: 'updateOne', collection: 'orders', update: { $set: { a: 1 } } }]), /needs a "filter"/i);
});

// --- malformed scripts -------------------------------------------------------

test('a script with no action or no operations is refused', () => {
  expectRejected({ operations: [] }, /needs an "action"/i);
  expectRejected({ action: 'upgrade:x' }, /non-empty "operations"/i);
  expectRejected({ action: 'upgrade:x', operations: [] }, /non-empty "operations"/i);
});

test('a non-object script is refused', () => {
  expectRejected('not a script', /must be a JSON object/i);
  expectRejected([], /must be a JSON object/i);
  expectRejected(null, /must be a JSON object/i);
});

test('a non-whole or zero version is refused', () => {
  expectRejected(script([{ op: 'deleteOne', collection: 'a', filter: { x: 1 } }], { version: 0 }), /whole number/i);
  expectRejected(script([{ op: 'deleteOne', collection: 'a', filter: { x: 1 } }], { version: 1.5 }), /whole number/i);
});

test('an insert with no documents is refused', () => {
  expectRejected(script([{ op: 'insertMany', collection: 'categories', documents: [] }]), /at least one document/i);
  expectRejected(script([{ op: 'insertOne', collection: 'categories' }]), /"document" object/i);
});

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
