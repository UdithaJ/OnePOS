// A mobile number may belong to only one customer.
//
// Three places had to agree for the block to hold:
//   1. the service rejects a taken number on create,
//   2. the same check runs before send-otp, so no SMS goes out for a number
//      that can never become a customer, and
//   3. an update cannot move a number onto a customer that already has one —
//      while a customer keeping its own number still saves.
//
// The model is stubbed through the require cache, so this runs without a
// database.
//
// Run: node main/__tests__/customer-duplicate-mobile.test.js

const assert = require('assert');
const path = require('path');

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

// --- stubs -----------------------------------------------------------------

let rows = [];
const saved = [];
// Set to have the stubbed write reject, standing in for the unique index
// firing on a save that got past the application check.
let writeError = null;

class CustomerStub {
  constructor(doc) {
    Object.assign(this, doc);
  }
  async save() {
    if (writeError) throw writeError;
    this._id = `customer-${saved.length + 1}`;
    saved.push(this);
    rows.push(this);
    return this;
  }
  static async findOne(query) {
    return rows.find(r => r.mobileNumber === query.mobileNumber) || null;
  }
  static async findByIdAndUpdate(id, data) {
    if (writeError) throw writeError;
    const row = rows.find(r => String(r._id) === String(id));
    if (!row) return null;
    Object.assign(row, data);
    return row;
  }
}

const modelPath = path.join(__dirname, '..', 'models', 'customer.js');
require.cache[require.resolve(modelPath)] = { id: modelPath, filename: modelPath, loaded: true, exports: CustomerStub };

const customerService = require('../services/customer.service');

// The otp controller is exercised through fake req/res so the send-otp gate is
// covered without standing up express.
const otpServicePath = path.join(__dirname, '..', 'services', 'otp.service.js');
let otpsSent = [];
require.cache[require.resolve(otpServicePath)] = {
  id: otpServicePath,
  filename: otpServicePath,
  loaded: true,
  exports: {
    createPending: async (mobileNumber) => { otpsSent.push(mobileNumber); },
    verifyOtp: () => ({}),
  },
};
const otpController = require('../controllers/otp.controller');

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function reset() {
  rows = [];
  saved.length = 0;
  otpsSent = [];
  writeError = null;
}

function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key error collection: onepos.customers'), {
    code: 11000,
    keyPattern: { mobileNumber: 1 },
  });
}

async function expectRejects(fn, expectedStatus) {
  try {
    await fn();
  } catch (err) {
    assert.strictEqual(err.status, expectedStatus, `expected status ${expectedStatus}, got ${err.status}`);
    return err;
  }
  assert.fail('expected the call to be rejected, but it resolved');
}

// --- tests -----------------------------------------------------------------

(async () => {
  console.log('customer duplicate mobile number');

  await test('a first customer with a given mobile number is created', async () => {
    reset();
    const created = await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    assert.strictEqual(created.mobileNumber, '0771234567');
    assert.strictEqual(saved.length, 1);
  });

  await test('a second customer with the same mobile number is rejected with 409', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    const err = await expectRejects(
      () => customerService.createCustomer({ firstName: 'Bob', mobileNumber: '0771234567' }),
      409,
    );
    assert.match(err.message, /already registered/i);
    assert.strictEqual(saved.length, 1, 'the duplicate must not have been saved');
  });

  await test('surrounding whitespace does not slip a duplicate past the check', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    await expectRejects(
      () => customerService.createCustomer({ firstName: 'Bob', mobileNumber: '  0771234567  ' }),
      409,
    );
    assert.strictEqual(saved.length, 1);
  });

  await test('a different mobile number is still accepted', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    await customerService.createCustomer({ firstName: 'Bob', mobileNumber: '0777654321' });
    assert.strictEqual(saved.length, 2);
  });

  await test('send-otp is refused for a registered number, and sends no SMS', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    const res = fakeRes();
    await otpController.sendOtp({ body: { mobileNumber: '0771234567', customer: {} } }, res);
    assert.strictEqual(res.statusCode, 409);
    assert.match(res.body.message, /already registered/i);
    assert.deepStrictEqual(otpsSent, [], 'no OTP should have been sent');
  });

  await test('send-otp still works for an unregistered number', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    const res = fakeRes();
    await otpController.sendOtp({ body: { mobileNumber: '0777654321', customer: {} } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(otpsSent, ['0777654321']);
  });

  await test('an update cannot take a mobile number that belongs to someone else', async () => {
    reset();
    await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    const bob = await customerService.createCustomer({ firstName: 'Bob', mobileNumber: '0777654321' });
    await expectRejects(
      () => customerService.updateCustomer(bob._id, { firstName: 'Bob', mobileNumber: '0771234567' }),
      409,
    );
  });

  await test('a customer keeping its own mobile number still updates', async () => {
    reset();
    const ann = await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    const updated = await customerService.updateCustomer(ann._id, { firstName: 'Anne', mobileNumber: '0771234567' });
    assert.strictEqual(updated.firstName, 'Anne');
    assert.strictEqual(updated.mobileNumber, '0771234567');
  });

  // The unique index is the backstop for two requests that both clear the
  // application check before either saves. Its driver error must reach the
  // caller as the same 409, not as a raw E11000 — and must not be swallowed
  // into a success or a 404.

  await test('a duplicate-key error on create surfaces as 409, not a silent success', async () => {
    reset();
    writeError = duplicateKeyError();
    const err = await expectRejects(
      () => customerService.createCustomer({ firstName: 'Bob', mobileNumber: '0771234567' }),
      409,
    );
    assert.match(err.message, /already registered/i);
  });

  await test('a duplicate-key error on update surfaces as 409, not a silent 404', async () => {
    reset();
    const ann = await customerService.createCustomer({ firstName: 'Ann', mobileNumber: '0771234567' });
    writeError = duplicateKeyError();
    await expectRejects(
      () => customerService.updateCustomer(ann._id, { firstName: 'Anne', mobileNumber: '0771234567' }),
      409,
    );
  });

  await test('an unrelated write error is passed through untouched', async () => {
    reset();
    writeError = new Error('connection lost');
    try {
      await customerService.createCustomer({ firstName: 'Bob', mobileNumber: '0771234567' });
      assert.fail('expected the call to be rejected');
    } catch (err) {
      assert.strictEqual(err.message, 'connection lost');
      assert.strictEqual(err.status, undefined, 'must not be relabelled as a 409');
    }
  });

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
})();
