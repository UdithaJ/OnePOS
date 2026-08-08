// Cash Box Summary (Cash Inflow) — non-bank payments against orders in the
// period, joined through the cash ledger to the session that recorded them.
//
// Each row is a payment *event*, so its money columns come from the snapshot
// frozen onto the payment when it was taken, not from the live order. Reading
// the order made every re-run show today's figures: settle an order and last
// month's report retroactively showed Due Amount 0. Payments predating the
// snapshot fall back to the order fields — run
// `node main/scripts/backfillPaymentSnapshots.js` to fill them in.

exports.buildPipeline = ({ params }) => [
  { $match: { createdDate: { $gte: params.fromDate, $lte: params.toDate } } },
  // Join payments — one order may have multiple payments. A plain $unwind drops
  // orders with no payments, which is why no order-state prefilter is needed.
  {
    $lookup: {
      from: 'payments',
      localField: '_id',
      foreignField: 'orderId',
      as: 'payments',
    },
  },
  { $unwind: '$payments' },
  { $match: { 'payments.paymentMethod': { $ne: 'bank' } } },
  {
    $lookup: {
      from: 'customers',
      localField: 'customerID',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  // Left join cashledgers — only PAYMENT event type matching this payment's _id
  {
    $lookup: {
      from: 'cashledgers',
      let: { paymentId: '$payments._id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$source_id', '$$paymentId'] },
                { $eq: ['$event_type', 'PAYMENT'] },
              ],
            },
          },
        },
      ],
      as: 'ledger',
    },
  },
  { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
  // Left join cashboxsessions to get openedAt (business date)
  {
    $lookup: {
      from: 'cashboxsessions',
      localField: 'ledger.sessionId',
      foreignField: '_id',
      as: 'session',
    },
  },
  { $unwind: { path: '$session', preserveNullAndEmptyArrays: true } },
  // Resolve the frozen figures once; fall back to the live order for payments
  // recorded before snapshots existed.
  {
    $addFields: {
      frozenTotal: { $ifNull: ['$payments.orderTotalAmount', '$totalAmount'] },
      frozenDiscount: { $ifNull: ['$payments.orderDiscount', { $ifNull: ['$discount', 0] }] },
      frozenDue: { $ifNull: ['$payments.dueAfter', '$dueAmount'] },
    },
  },
  {
    $project: {
      _id: 0,
      orderId: '$_id',
      orderNo: 1,
      createdDate: 1,
      businessDate: '$session.openedAt',
      customerName: {
        $concat: [
          '$customer.firstName',
          {
            $cond: [
              { $ifNull: ['$customer.lastName', false] },
              { $concat: [' ', '$customer.lastName'] },
              '',
            ],
          },
        ],
      },
      totalAmount: '$frozenTotal',
      discount: '$frozenDiscount',
      orderAmountAfterDiscount: { $subtract: ['$frozenTotal', '$frozenDiscount'] },
      dueAmount: '$frozenDue',
      paymentMethod: '$payments.paymentMethod',
      paymentReceived: '$payments.amount',
    },
  },
  { $sort: { createdDate: 1, orderNo: 1 } },
];
