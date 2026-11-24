// The lookups behind opening the New Order form: the open cash box session and
// the category list. Both used to read whole collections; these check they now
// ask the database one narrow question each.
//
// The models are stubbed through the require cache, so this runs without a
// database.
//
// Run: node main/__tests__/new-order-lookups.test.js

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

// --- models -----------------------------------------------------------------

const calls = [];
const categories = [
  { _id: 'c1', name: 'Wash' },
  { _id: 'c2', name: 'Dry' },
  { _id: 'c3', name: 'Iron' },
];
const usedCategoryIds = ['c1', 'c3'];

stub('models/category.js', {
  find: () => ({
    lean: async () => categories.map((c) => ({ ...c })),
    sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => categories.map((c) => ({ ...c })) }) }) }),
  }),
  countDocuments: async () => categories.length,
});
stub('models/orderCategory.js', {
  distinct: async (field, filter) => { calls.push(['distinct', field, filter]); return usedCategoryIds; },
  countDocuments: async (filter) => { calls.push(['countDocuments', filter]); return 0; },
});

let openSession = { _id: 's9', status: 'open' };
stub('models/cashBoxSession.js', {
  findOne: (filter) => ({ sort: async (order) => { calls.push(['findOne', filter, order]); return openSession; } }),
  find: async () => { calls.push(['find']); return []; },
});
stub('services/cashLedger.service.js', { getSessionLedgerTotals: async () => ({}) });

const categoryService = require('../services/category.service');
const sessionService = require('../services/cashBoxSession.service');

(async () => {
  console.log('new order lookups');

  await test('the order form gets categories without usage, and without querying order items', async () => {
    calls.length = 0;
    const list = await categoryService.getAllCategories({ usage: false });
    assert.deepStrictEqual(list.map((c) => c.name), ['Wash', 'Dry', 'Iron']);
    assert.ok(list.every((c) => !('inUse' in c)));
    assert.strictEqual(calls.length, 0);
  });

  await test('the full list marks in-use categories with one query, not one per category', async () => {
    calls.length = 0;
    const list = await categoryService.getAllCategories();
    assert.deepStrictEqual(list.map((c) => [c._id, c.inUse]), [['c1', true], ['c2', false], ['c3', true]]);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], ['distinct', 'category', { category: { $in: ['c1', 'c2', 'c3'] } }]);
  });

  await test('the paginated admin list marks usage the same way', async () => {
    calls.length = 0;
    const { items } = await categoryService.getCategoriesPaginated({ page: 1, limit: 10 });
    assert.deepStrictEqual(items.map((c) => c.inUse), [true, false, true]);
    assert.strictEqual(calls.filter((c) => c[0] === 'countDocuments').length, 0);
  });

  await test('the open session is one lookup by status, not every session', async () => {
    calls.length = 0;
    assert.deepStrictEqual(await sessionService.getActiveCashBoxSession(), openSession);
    assert.deepStrictEqual(calls, [['findOne', { status: 'open' }, { _id: 1 }]]);
    openSession = null;
    assert.strictEqual(await sessionService.getActiveCashBoxSession(), null);
  });

  await test('the lookups have indexes to use', async () => {
    for (const k of Object.keys(require.cache)) if (/models[\\/](orderCategory|cashBoxSession)\.js$/.test(k)) delete require.cache[k];
    const OrderCategory = require('../models/orderCategory');
    const CashBoxSession = require('../models/cashBoxSession');
    const has = (model, field) => model.schema.indexes().some(([keys]) => Object.keys(keys)[0] === field);
    assert.ok(has(OrderCategory, 'category'), 'order item category');
    assert.ok(has(CashBoxSession, 'status'), 'session status');
  });

  if (failures) {
    console.error(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nall passed');
})();
