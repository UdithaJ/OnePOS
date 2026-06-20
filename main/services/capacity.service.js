const OrderCategory = require('../models/orderCategory');
const CashBoxSession = require('../models/cashBoxSession');
const systemSettingsService = require('./systemSettings.service');

const DAY_MS = 24 * 60 * 60 * 1000;

// "Today" for capacity = the date portion of the active cashbox session's openedAt.
// Cashier picks the session start date/time when opening; for late-night opens
// they can set it to tomorrow so capacity is attributed to the next business day.
// Falls back to wall clock when no session is open.
async function getBusinessToday() {
  const session = await CashBoxSession.findOne({ status: 'open' }).sort({ openedAt: -1 });
  const ref = session ? new Date(session.openedAt) : new Date();
  ref.setHours(0, 0, 0, 0);
  return ref;
}

async function sumPendingKg() {
  const result = await OrderCategory.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'order'
      }
    },
    { $unwind: '$order' },
    { $match: { 'order.status': { $in: ['todo'] } } },
    { $group: { _id: null, totalKg: { $sum: '$weight' } } }
  ]);
  return result.length ? Number(result[0].totalKg) || 0 : 0;
}

// Days available to process, inclusive of both today and the due date.
// Today -> 1 day, tomorrow -> 2 days, etc. Past dates collapse to 1.
function daysUntil(deliveryDate, today) {
  const due = new Date(deliveryDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / DAY_MS) + 1;
  return Math.max(1, diff);
}

exports.checkCapacity = async ({ deliveryDate, newOrderKg }) => {
  const settings = await systemSettingsService.getSettings();
  const capacityPerDayKg = Number(settings.dailyCapacityKg) || 0;
  const newKg = Number(newOrderKg) || 0;

  if (capacityPerDayKg <= 0) {
    return {
      ok: true,
      pendingKg: 0,
      newOrderKg: newKg,
      capacityPerDayKg: 0,
      daysUntilDue: 0,
      maxProcessableKg: 0,
      message: 'Daily capacity not configured; check skipped.'
    };
  }

  const today = await getBusinessToday();
  const pendingKg = await sumPendingKg();
  const daysUntilDue = daysUntil(deliveryDate, today);
  const maxProcessableKg = daysUntilDue * capacityPerDayKg;
  const ok = (pendingKg + newKg) <= maxProcessableKg;

  return {
    ok,
    pendingKg,
    newOrderKg: newKg,
    capacityPerDayKg,
    daysUntilDue,
    maxProcessableKg,
    message: ok
      ? 'Within capacity.'
      : `Pending ${pendingKg}kg + new ${newKg}kg exceeds ${maxProcessableKg}kg processable by ${new Date(deliveryDate).toDateString()}.`
  };
};
