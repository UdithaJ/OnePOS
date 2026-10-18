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
// In business mode the transaction's own date says nothing reliable about its
// business day, in either direction: a session opened on the last day of the
// period may record activity after midnight, and at the nightly reopen (22:00)
// the cashier sets the next session's start to the next working morning —
// Monday 08:00 when reopening on a Friday night — so the evening's sales are
// dated before the session they belong to. So nothing is filtered on the
// transaction's date; every row is attributed to its session and the period is
// applied to the business date alone.
//
// Rows recorded without a session have no ledger entry and fall back to their
// own date.
function periodStages({ basis, dateField, fromDate, toDate }) {
  if (basis !== 'business') {
    return [{ $match: { [dateField]: { $gte: fromDate, $lte: toDate } } }];
  }

  return [
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
