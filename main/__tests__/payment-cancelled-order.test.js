// A cancelled order takes no payments: the payment route refuses it before
// anything is written.
//
// The models are stubbed through the require cache, so this runs without a
// database.
//
// Run: node main/__tests__/payment-cancelled-order.test.js

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
stub('models/order.js', { findById: async () => order });
class PaymentStub {
  constructor(data) { Object.assign(this, data); }
  async save() { writes.push(['payment', this]); return this; }
}
PaymentStub.find = async () => [];
stub('models/payment.js', PaymentStub);
stub('models/bankTransfer.js', class { async save() { writes.push(['bankTransfer']); } });
stub('services/cashLedger.service.js', { createCashLedger: async () => { writes.push(['ledger']); } });

const { createPayment, CANCELLED_MESSAGE } = require('../controllers/payment.controller');

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    createPayment({ body }, res);
  });
}

function makeOrder(status) {
  return { _id: 'o1', status, totalAmount: 1000, discount: 0, dueAmount: 1000, paymentStatus: 'unpaid', save: async () => writes.push(['order']) };
}

(async () => {
  console.log('payments on cancelled orders');

  await test('a payment on a cancelled order is refused and nothing is written', async () => {
    order = makeOrder('cancelled');
    writes.length = 0;
    const res = await call({ orderId: 'o1', amount: 500, type: 'advance', paymentMethod: 'cash', userId: 'u1', sessionId: 's1' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.message, CANCELLED_MESSAGE);
    assert.deepStrictEqual(writes, []);
  });

  await test('a bank payment on a cancelled order is refused too', async () => {
    order = makeOrder('cancelled');
    writes.length = 0;
    const res = await call({ orderId: 'o1', amount: 500, type: 'advance', paymentMethod: 'bank', transactionId: 'T1' });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(writes, []);
  });

  for (const status of ['todo', 'done']) {
    await test(`a payment on a ${status} order is still taken`, async () => {
      order = makeOrder(status);
      writes.length = 0;
      const res = await call({ orderId: 'o1', amount: 500, type: 'advance', paymentMethod: 'cash', userId: 'u1', sessionId: 's1' });
      assert.notStrictEqual(res.status, 400, JSON.stringify(res.data));
      assert.ok(writes.some(([w]) => w === 'payment'));
      assert.strictEqual(order.paymentStatus, 'partial');
    });
  }

  if (failures) {
    console.error(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nall passed');
})();
