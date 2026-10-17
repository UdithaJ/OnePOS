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
// after midnight — so only a lower bound is used up front, to narrow the rows
// before the lookups. It reaches back BUSINESS_LOOKBACK_MS before fromDate
// because a session's start can be later than its first transactions: at the
// nightly reopen (22:00) the cashier sets the start to the next working
// morning — Monday 08:00 when reopening on a Friday night — so the evening's
// sales are dated before the session they belong to. A week covers weekends
// and holiday closures. The exact period is applied to the business date at
// the end.
//
// Rows recorded without a session have no ledger entry and fall back to their
// own date.
const BUSINESS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function periodStages({ basis, dateField, fromDate, toDate }) {
  if (basis !== 'business') {
    return [{ $match: { [dateField]: { $gte: fromDate, $lte: toDate } } }];
  }

  const lookbackFrom = new Date(new Date(fromDate).getTime() - BUSINESS_LOOKBACK_MS);
  return [
    { $match: { [dateField]: { $gte: lookbackFrom } } },
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
