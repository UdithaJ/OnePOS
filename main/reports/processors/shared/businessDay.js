// Business-day attribution shared by the cash reports.
//
// A cash box session can stay open past midnight, so a payment or expense
// recorded at 00:30 belongs to the business day the drawer was opened on, not
// to the calendar day it happened. Every transaction recorded in a session has
// a cash-ledger row (source_id = the payment/expense id) pointing at that
// session, which is what these stages follow.
//
// Not a report processor: no definition names it, so the engine never loads it.

const DATE_BASES = ['transaction', 'business'];

function resolveDateBasis(value) {
  if (value === null || value === undefined) return 'transaction';
  if (!DATE_BASES.includes(value)) {
    const err = new Error(`Parameter "dateBasis" must be one of: ${DATE_BASES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return value;
}

// $match / $lookup stages that keep only rows in the period and leave the
// row's attributed day in `businessDate`.
//
// In business mode the upper bound cannot be applied to the transaction's own
// date — a session opened on the last day of the period may record activity
// after midnight — so only the lower bound is used up front. That is safe
// because a transaction is always dated when it is recorded, which is never
// before its session opened.
//
// Rows recorded without a session have no ledger entry and fall back to their
// own date.
function periodStages({ basis, dateField, fromDate, toDate }) {
  if (basis !== 'business') {
    return [{ $match: { [dateField]: { $gte: fromDate, $lte: toDate } } }];
  }

  return [
    { $match: { [dateField]: { $gte: fromDate } } },
    {
      $lookup: {
        from: 'cashledgers',
        let: { sourceId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$source_id', '$$sourceId'] } } },
          // One ledger row per transaction is the norm; never let a stray
          // duplicate double a row and inflate the totals.
          { $limit: 1 },
        ],
        as: 'businessLedger',
      },
    },
    { $unwind: { path: '$businessLedger', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'cashboxsessions',
        localField: 'businessLedger.sessionId',
        foreignField: '_id',
        as: 'businessSession',
      },
    },
    { $unwind: { path: '$businessSession', preserveNullAndEmptyArrays: true } },
    { $addFields: { businessDate: { $ifNull: ['$businessSession.openedAt', `$${dateField}`] } } },
    { $match: { businessDate: { $gte: fromDate, $lte: toDate } } },
  ];
}

module.exports = { resolveDateBasis, periodStages };
