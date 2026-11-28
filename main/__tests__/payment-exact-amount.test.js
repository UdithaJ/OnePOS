// A full payment or a settlement must be exactly the due amount — not more,
// not less. An advance may be any amount up to the due.
//
// The models are stubbed through the require cache, so this runs without a
// database.
//
// Run: node main/__tests__/payment-exact-amount.test.js

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

const stub = (rel, exports) => {
  const p = path.join(__dirname, '..', rel);
  require.cache[require.resolve(p)] = { id: p, filename: p, loaded: true, exports };
};

const writes = [];
let order;
let earlierPayments = [];
stub('models/order.js', { findById: async () => order });
class PaymentStub {
  constructor(data) { Object.assign(this, data); }
  async save() { writes.push(['payment', this]); return this; }
}
PaymentStub.find = async () => earlierPayments;
stub('models/payment.js', PaymentStub);
stub('models/bankTransfer.js', class { async save() { writes.push(['bankTransfer']); } });
stub('services/cashLedger.service.js', { createCashLedger: async () => { writes.push(['ledger']); } });

const { createPayment, EXACT_AMOUNT_MESSAGE } = require('../controllers/payment.controller');

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    createPayment({ body: { orderId: 'o1', paymentMethod: 'cash', ...body } }, res);
  });
}

// Total 1000, discount 100 → due 900 before any payment.
function setup(paid = 0) {
  order = { _id: 'o1', status: 'todo', totalAmount: 1000, discount: 100, paymentStatus: 'unpaid', save: async () => writes.push(['order']) };
  earlierPayments = paid ? [{ amount: paid, type: 'advance' }] : [];
  writes.length = 0;
}

(async () => {
  console.log('full payment and settlement amounts');

  await test('a full payment less than the due is refused and nothing is written', async () => {
    setup();
    const res = await call({ amount: 899, type: 'full_payment' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.message, EXACT_AMOUNT_MESSAGE);
    assert.deepStrictEqual(writes, []);
  });

  await test('a full payment more than the due is refused', async () => {
    setup();
    const res = await call({ amount: 901, type: 'full_payment' });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(writes, []);
  });

  await test('a full payment of exactly the due is taken and marks the order paid', async () => {
    setup();
    const res = await call({ amount: 900, type: 'full_payment' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.data));
    assert.strictEqual(order.paymentStatus, 'paid');
    assert.strictEqual(order.dueAmount, 0);
  });

  await test('the due typed as a string is accepted', async () => {
    setup();
    const res = await call({ amount: '900', type: 'full_payment' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.data));
  });

  await test('a settlement less than the remaining due is refused', async () => {
    setup(300); // 600 left
    const res = await call({ amount: 500, type: 'settlement' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.message, EXACT_AMOUNT_MESSAGE);
    assert.deepStrictEqual(writes, []);
  });

  await test('a settlement more than the remaining due is refused', async () => {
    setup(300);
    const res = await call({ amount: 700, type: 'settlement' });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(writes, []);
  });

  await test('a settlement of exactly the remaining due is taken', async () => {
    setup(300);
    const res = await call({ amount: 600, type: 'settlement' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.data));
    assert.strictEqual(order.paymentStatus, 'paid');
  });

  await test('a float-drifted due still accepts the amount shown on screen', async () => {
    setup();
    order.totalAmount = 900.0000000001;
    order.discount = 0;
    const res = await call({ amount: 900, type: 'full_payment' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.data));
  });

  await test('an advance may still be less than the due', async () => {
    setup();
    const res = await call({ amount: 200, type: 'advance' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.data));
    assert.strictEqual(order.paymentStatus, 'partial');
  });

  if (failures) {
    console.error(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nall passed');
})();
