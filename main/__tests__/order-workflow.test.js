// Order status transitions: which moves are legal, who may make them, and what
// the order must look like first.
//
// Two halves:
//   1. the table itself (pure, no database), and
//   2. updateOrder enforcing it — including that a rejected transition writes
//      nothing at all, which is what the compute/commit split in updateOrder
//      buys us.
//
// The models are stubbed through the require cache, so this runs without a
// database.
//
// Run: node main/__tests__/order-workflow.test.js

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

// --- part 1: the table ------------------------------------------------------

const wf = require('../workflow/orderWorkflow');
const T = wf.DEFAULT_TRANSITIONS;
const PAID = { paymentStatus: 'paid' };
const UNPAID = { paymentStatus: 'unpaid' };

function expectBlocked(from, to, role, context, status) {
  const { allowed, error } = wf.canTransition(T, from, to, role, context);
  assert.strictEqual(allowed, false, `${from} -> ${to} as ${role} should be blocked`);
  assert.strictEqual(error.status, status, `expected ${status}, got ${error.status}: ${error.message}`);
  return error;
}

function expectAllowed(from, to, role, context) {
  const { allowed, error } = wf.canTransition(T, from, to, role, context);
  assert.strictEqual(allowed, true, `${from} -> ${to} as ${role} should be allowed (${error && error.message})`);
}

(async () => {
  console.log('order workflow — the transition table');

  await test('a cashier cannot cancel an order', async () => {
    const err = expectBlocked('todo', 'cancelled', 'cashier', PAID, 403);
    assert.match(err.message, /only admin users/i);
  });

  await test('an admin can cancel an order', async () => {
    expectAllowed('todo', 'cancelled', 'admin', PAID);
    expectAllowed('done', 'cancelled', 'admin', UNPAID);
  });

  await test('the built-in sysadmin counts as an administrator', async () => {
    // It is hidden from the user list but must still be able to do everything
    // an admin can, or the account cannot recover a system.
    expectAllowed('todo', 'cancelled', 'sysadmin', PAID);
    expectAllowed('cancelled', 'todo', 'sysadmin', PAID);
  });

  await test('an unknown role cannot cancel (no acting user resolved)', async () => {
    expectBlocked('todo', 'cancelled', null, PAID, 403);
  });

  await test('an unpaid order cannot be marked delivered, whoever asks', async () => {
    const err = expectBlocked('done', 'delivered', 'admin', UNPAID, 422);
    assert.match(err.message, /payment status is Paid/i);
    expectBlocked('done', 'delivered', 'cashier', { paymentStatus: 'partial' }, 422);
  });

  await test('a paid order can be marked delivered by a cashier', async () => {
    expectAllowed('done', 'delivered', 'cashier', PAID);
    expectAllowed('todo', 'delivered', 'cashier', PAID);
  });

  await test('delivered is terminal', async () => {
    expectBlocked('delivered', 'todo', 'admin', PAID, 422);
    expectBlocked('delivered', 'cancelled', 'admin', PAID, 422);
  });

  await test('staying on the same status is never a transition', async () => {
    expectAllowed('delivered', 'delivered', null, UNPAID);
    expectAllowed('cancelled', 'cancelled', 'cashier', UNPAID);
  });

  await test('reopening a cancelled order is an admin action', async () => {
    expectBlocked('cancelled', 'todo', 'cashier', PAID, 403);
    expectAllowed('cancelled', 'todo', 'admin', PAID);
  });

  await test('an unknown status is rejected as unprocessable', async () => {
    expectBlocked('todo', 'shipped', 'admin', PAID, 422);
  });

  await test('describeTargets explains why a blocked option is blocked', async () => {
    const rows = wf.describeTargets(T, 'done', 'cashier', UNPAID);
    const byValue = Object.fromEntries(rows.map(r => [r.value, r]));
    assert.strictEqual(byValue.done.allowed, true);
    assert.strictEqual(byValue.cancelled.allowed, false);
    assert.match(byValue.cancelled.reason, /admin/i);
    assert.strictEqual(byValue.delivered.allowed, false);
    assert.match(byValue.delivered.reason, /Paid/i);
  });

  // The table is data now, so these cover a table that differs from the shipped
  // one — which is the whole point of storing it.

  await test('a stored table may open a transition the shipped rules restrict', async () => {
    const permissive = { todo: { cancelled: {} } };
    const { allowed } = wf.canTransition(permissive, 'todo', 'cancelled', 'cashier', PAID);
    assert.strictEqual(allowed, true, 'no roles on the rule means anyone may make the move');
  });

  await test('a stored table may restrict a transition the shipped rules allow', async () => {
    const strict = { todo: { done: { roles: ['admin'] } } };
    const { allowed, error } = wf.canTransition(strict, 'todo', 'done', 'cashier', PAID);
    assert.strictEqual(allowed, false);
    assert.strictEqual(error.status, 403);
  });

  await test('a missing row means the move is not permitted at all', async () => {
    const { allowed, error } = wf.canTransition({ todo: { done: {} } }, 'todo', 'delivered', 'admin', PAID);
    assert.strictEqual(allowed, false);
    assert.strictEqual(error.status, 422);
    assert.match(error.message, /cannot move/i);
  });

  await test('a rule naming an unknown guard blocks rather than ignoring it', async () => {
    const typo = { todo: { delivered: { guards: ['requirePayed'] } } };
    const { allowed, error } = wf.canTransition(typo, 'todo', 'delivered', 'admin', PAID);
    assert.strictEqual(allowed, false, 'an unrecognised guard must not be skipped');
    assert.strictEqual(error.status, 422);
    assert.match(error.message, /unknown condition/i);
  });

  // --- part 2: updateOrder enforcing the table ------------------------------

  console.log('\norder workflow — updateOrder enforcement');

  // Stubs. Registered before order.service is required.
  const stub = (rel, exports) => {
    const p = path.join(__dirname, '..', rel);
    require.cache[require.resolve(p)] = { id: p, filename: p, loaded: true, exports };
  };

  let orderDoc = null;
  let updateCalls = [];
  let deleteManyCalls = [];
  let createdSuborders = [];
  let users = {};
  let paymentRows = [];

  // findByIdAndUpdate returns a Query in mongoose, so .populate() is chained on
  // the return value rather than on the awaited document.
  const OrderStub = {
    findById: async () => orderDoc,
    findByIdAndUpdate: (id, data) => {
      updateCalls.push({ id, data });
      const doc = { ...orderDoc, ...data };
      return { populate: async () => doc, then: (res) => res(doc) };
    },
  };

  // Category rows the planned suborders resolve against.
  let categoryRows = [];

  stub('models/order.js', OrderStub);
  stub('models/orderCategory.js', class OrderCategoryStub {
    constructor(doc) { Object.assign(this, doc); }
    async save() { this._id = `sub-${createdSuborders.length + 1}`; createdSuborders.push(this); return this; }
    static find() { return { lean: async () => [] }; }
    static async deleteMany(q) { deleteManyCalls.push(q); return { deletedCount: 0 }; }
  });
  stub('models/payment.js', { find: async () => paymentRows });
  // Rows the loader reads. Empty means "nothing stored for this entity", which
  // must fall back to the shipped rules rather than locking every order down.
  let transitionRows = [];
  let lastQuery = null;
  stub('models/workflowStateMachine.js', {
    find: (q) => { lastQuery = q; return { lean: async () => transitionRows }; },
  });
  stub('models/user.js', { default: { findById: async (id) => users[String(id)] || null } });
  stub('models/customer.js', { findById: async () => null });
  stub('models/category.js', { find: async () => categoryRows });
  stub('services/messaging.service.js', { sendSms: async () => ({ sent: 0 }) });

  const orderService = require('../services/order.service');

  function reset() {
    transitionRows = [];
    lastQuery = null;
    updateCalls = [];
    deleteManyCalls = [];
    createdSuborders = [];
    paymentRows = [];
    users = {
      admin1: { _id: 'admin1', userRole: 'admin' },
      cash1: { _id: 'cash1', userRole: 'cashier' },
    };
    orderDoc = {
      _id: 'order1', status: 'todo', paymentStatus: 'unpaid',
      totalAmount: 1000, discount: 0, suborders: [],
    };
  }

  async function expectRejected(fn, status) {
    try {
      await fn();
    } catch (err) {
      assert.strictEqual(err.status, status, `expected ${status}, got ${err.status}: ${err.message}`);
      return err;
    }
    assert.fail('expected the update to be rejected, but it resolved');
  }

  await test('a cashier cancelling an order is rejected with 403, nothing written', async () => {
    reset();
    await expectRejected(
      () => orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'cash1' }),
      403,
    );
    assert.strictEqual(updateCalls.length, 0, 'the order must not have been updated');
  });

  await test('an admin cancelling an order succeeds', async () => {
    reset();
    await orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'admin1' });
    assert.strictEqual(updateCalls.length, 1);
    assert.strictEqual(updateCalls[0].data.status, 'cancelled');
  });

  await test('the acting user id is never written onto the order', async () => {
    reset();
    await orderService.updateOrder('order1', { status: 'done', actingUserId: 'cash1' });
    assert.strictEqual('actingUserId' in updateCalls[0].data, false);
  });

  await test('saving an already-cancelled order does not require admin', async () => {
    reset();
    orderDoc.status = 'cancelled';
    await orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'cash1' });
    assert.strictEqual(updateCalls.length, 1, 'an unchanged status is not a transition');
  });

  await test('an unpaid order cannot be marked delivered', async () => {
    reset();
    orderDoc.status = 'done';
    const err = await expectRejected(
      () => orderService.updateOrder('order1', { status: 'delivered', actingUserId: 'admin1' }),
      422,
    );
    assert.match(err.message, /Paid/i);
    assert.strictEqual(updateCalls.length, 0);
  });

  await test('a fully paid order can be marked delivered', async () => {
    reset();
    orderDoc.status = 'done';
    paymentRows = [{ amount: 1000 }];
    await orderService.updateOrder('order1', { status: 'delivered', actingUserId: 'cash1' });
    assert.strictEqual(updateCalls.length, 1);
    assert.strictEqual(updateCalls[0].data.paymentStatus, 'paid');
  });

  await test('a discount settling the order in the same save allows delivery', async () => {
    reset();
    orderDoc.status = 'done';
    // 600 paid against a 1000 order, with a 400 discount applied right now.
    paymentRows = [{ amount: 600 }];
    await orderService.updateOrder('order1', {
      status: 'delivered', discount: 400, actingUserId: 'cash1',
    });
    assert.strictEqual(updateCalls.length, 1, 'the recomputed payment status should satisfy the guard');
    assert.strictEqual(updateCalls[0].data.paymentStatus, 'paid');
  });

  await test('a part-paid order is still refused delivery', async () => {
    reset();
    orderDoc.status = 'done';
    paymentRows = [{ amount: 600 }];
    await expectRejected(
      () => orderService.updateOrder('order1', { status: 'delivered', actingUserId: 'admin1' }),
      422,
    );
  });

  await test('a delivered order cannot be moved back', async () => {
    reset();
    orderDoc.status = 'delivered';
    paymentRows = [{ amount: 1000 }];
    await expectRejected(
      () => orderService.updateOrder('order1', { status: 'todo', actingUserId: 'admin1' }),
      422,
    );
  });

  await test('a rejected transition leaves the suborders untouched', async () => {
    reset();
    orderDoc.status = 'todo';
    orderDoc.suborders = ['sub1', 'sub2'];
    await expectRejected(
      () => orderService.updateOrder('order1', {
        status: 'cancelled',
        actingUserId: 'cash1',
        suborders: [],
      }),
      403,
    );
    assert.deepStrictEqual(deleteManyCalls, [], 'suborders must not be deleted when the update is refused');
    assert.strictEqual(updateCalls.length, 0);
  });

  // Positive control for the test above: on a path that is NOT rejected, the
  // suborder rewrite really does run — otherwise that assertion proves nothing.
  await test('an accepted suborder change does rewrite the suborders', async () => {
    reset();
    categoryRows = [{ _id: 'cat1', price: 100, unit: 'kg' }];
    orderDoc.suborders = ['sub1'];
    await orderService.updateOrder('order1', {
      status: 'done',
      actingUserId: 'cash1',
      suborders: [{ category: 'cat1', weight: 2 }],
    });
    assert.strictEqual(deleteManyCalls.length, 1, 'the old suborders should have been removed');
    assert.strictEqual(createdSuborders.length, 1, 'the new suborder should have been created');
    assert.strictEqual(updateCalls.length, 1);
  });

  await test('an update that does not touch status still works', async () => {
    reset();
    await orderService.updateOrder('order1', { rackNumber: 'A12' });
    assert.strictEqual(updateCalls.length, 1);
    assert.strictEqual(updateCalls[0].data.rackNumber, 'A12');
  });

  await test('an unseeded collection falls back to the shipped rules', async () => {
    reset();
    transitionRows = [];
    await expectRejected(
      () => orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'cash1' }),
      403,
    );
  });

  await test('stored rules are what is enforced, not the shipped ones', async () => {
    reset();
    // The shipped rules restrict cancelling to admins; this table does not.
    transitionRows = [{ entity: 'order', from: 'todo', to: 'cancelled', roles: [], guards: [], enabled: true }];
    await orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'cash1' });
    assert.strictEqual(updateCalls.length, 1, 'the stored rule should have permitted this');
  });

  await test('the machine is loaded for the order entity only', async () => {
    reset();
    await orderService.updateOrder('order1', { status: 'done', actingUserId: 'cash1' });
    assert.deepStrictEqual(lastQuery, { entity: 'order', enabled: true },
      'the loader must scope the query to this entity and skip disabled rows');
  });

  await test('a transition absent from the stored table is refused', async () => {
    reset();
    transitionRows = [{ entity: 'order', from: 'todo', to: 'done', roles: [], guards: [], enabled: true }];
    await expectRejected(
      () => orderService.updateOrder('order1', { status: 'cancelled', actingUserId: 'admin1' }),
      422,
    );
  });

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
})();
