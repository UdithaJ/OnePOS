// Dashboard figures, worked out in the database so the client only renders them.
//
// "Today" follows the report convention: the client sends the absolute instants
// for the start and end of its local day, plus its IANA timezone for grouping
// by month. Cash box figures are not here — they have their own endpoints.
const Order = require('../models/order');
const OrderCategory = require('../models/orderCategory');
const Category = require('../models/category');
const Customer = require('../models/customer');
const { resolveTimezone } = require('../reports/engine/paramBinder');

function parseInstant(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The window for "today". Falls back to the server's local day when the client
// sends nothing usable; in the desktop app the server runs on the shop's machine.
function resolveDayWindow(dayStart, dayEnd, now = new Date()) {
  const start = parseInstant(dayStart);
  const end = parseInstant(dayEnd);
  if (start && end && start <= end) return { start, end };

  const localStart = new Date(now);
  localStart.setHours(0, 0, 0, 0);
  const localEnd = new Date(localStart);
  localEnd.setHours(23, 59, 59, 999);
  return { start: localStart, end: localEnd };
}

// Joins each order's suborders; an order keeps only the ids.
function lookupSuborders() {
  return {
    $lookup: {
      from: OrderCategory.collection.name,
      localField: 'suborders',
      foreignField: '_id',
      as: '_subs',
    },
  };
}

function pendingPipeline() {
  return [
    { $match: { status: 'todo' } },
    lookupSuborders(),
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        weightKg: { $sum: { $sum: '$_subs.weight' } },
      },
    },
  ];
}

function weightByCategoryPipeline({ start, end }) {
  return [
    { $match: { createdDate: { $gte: start, $lte: end } } },
    lookupSuborders(),
    { $unwind: '$_subs' },
    {
      $lookup: {
        from: Category.collection.name,
        localField: '_subs.category',
        foreignField: '_id',
        as: '_cat',
      },
    },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ['$_cat.name', 0] }, 'Unknown'] },
        weightKg: { $sum: { $ifNull: ['$_subs.weight', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

async function getSummary({ dayStart, dayEnd } = {}) {
  const today = resolveDayWindow(dayStart, dayEnd);

  const [doneCount, ordersTodayCount, pending, byCategory] = await Promise.all([
    Order.countDocuments({ status: 'done' }),
    Order.countDocuments({ createdDate: { $gte: today.start, $lte: today.end } }),
    Order.aggregate(pendingPipeline()),
    Order.aggregate(weightByCategoryPipeline(today)),
  ]);

  return {
    doneCount,
    ordersTodayCount,
    pendingCount: pending[0]?.count || 0,
    pendingWeightKg: pending[0]?.weightKg || 0,
    todayWeightByCategory: byCategory.map(r => ({ category: r._id, weightKg: r.weightKg })),
  };
}

// Periods the monthly chart offers; anything else gets the default.
const MONTH_RANGES = [3, 6, 12];
const DEFAULT_MONTHS = 12;

function resolveMonths(value) {
  const n = Number(value);
  return MONTH_RANGES.includes(n) ? n : DEFAULT_MONTHS;
}

// The chart's months as 'YYYY-MM', oldest first: the current month in the
// shop's timezone and the ones before it. The current month is still running,
// so its count is partial; the first month is always complete.
function monthKeys(months, timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' })
    .formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year').value);
  const month = Number(parts.find(p => p.type === 'month').value);

  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const total = year * 12 + (month - 1) - i;
    keys.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return keys;
}

// Order volume per month from the first month of the window. Cancelled orders
// are not volume, so they are left out. The window starts at local midnight on
// the 1st, which Mongo works out from the timezone.
function monthlyCountPipeline(timezone, firstMonth) {
  const [year, month] = firstMonth.split('-').map(Number);
  return [
    {
      $match: {
        status: { $ne: 'cancelled' },
        $expr: { $gte: ['$createdDate', { $dateFromParts: { year, month, day: 1, timezone } }] },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdDate', timezone } },
        count: { $sum: 1 },
      },
    },
  ];
}

// Every month in the window, with 0 for months that had no orders, so a quiet
// month is plotted rather than skipped.
function fillMonths(keys, rows) {
  const counts = new Map(rows.map(r => [r._id, r.count]));
  return keys.map(month => ({ month, count: counts.get(month) || 0 }));
}

async function getMonthlyOrderCount({ months, tz } = {}) {
  const timezone = resolveTimezone(tz);
  const keys = monthKeys(resolveMonths(months), timezone);
  const rows = await Order.aggregate(monthlyCountPipeline(timezone, keys[0]));
  return fillMonths(keys, rows);
}

// Orders that are finished and paid for, waiting to be handed over.
function deliveryPendingPipeline() {
  return [
    { $match: { status: 'done', paymentStatus: 'paid' } },
    { $sort: { orderNo: -1 } },
    {
      $lookup: {
        from: Customer.collection.name,
        localField: 'customerID',
        foreignField: '_id',
        as: '_cust',
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        orderNo: 1,
        deliveryDate: 1,
        customerName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: [{ $arrayElemAt: ['$_cust.firstName', 0] }, ''] },
                ' ',
                { $ifNull: [{ $arrayElemAt: ['$_cust.lastName', 0] }, ''] },
              ],
            },
          },
        },
      },
    },
  ];
}

async function getDeliveryPending() {
  return await Order.aggregate(deliveryPendingPipeline());
}

module.exports = {
  resolveDayWindow,
  pendingPipeline,
  weightByCategoryPipeline,
  resolveMonths,
  monthKeys,
  monthlyCountPipeline,
  fillMonths,
  deliveryPendingPipeline,
  getSummary,
  getMonthlyOrderCount,
  getDeliveryPending,
};
