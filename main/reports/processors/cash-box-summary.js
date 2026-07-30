// Cash Box Summary (Cash Inflow) — non-bank payments against orders in the
// period, joined through the cash ledger to the session that recorded them.

exports.buildPipeline = ({ params }) => [
  {
    $match: {
      createdDate: { $gte: params.fromDate, $lte: params.toDate },
      $expr: {
        $ne: ['$dueAmount', { $subtract: ['$totalAmount', { $ifNull: ['$discount', 0] }] }],
      },
    },
  },
  // Left join payments — one order may have multiple payments
  {
    $lookup: {
      from: 'payments',
      localField: '_id',
      foreignField: 'orderId',
      as: 'payments',
    },
  },
  { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
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
      totalAmount: 1,
      discount: { $ifNull: ['$discount', 0] },
      orderAmountAfterDiscount: { $subtract: ['$totalAmount', { $ifNull: ['$discount', 0] }] },
      dueAmount: 1,
      paymentMethod: '$payments.paymentMethod',
      paymentReceived: '$payments.amount',
    },
  },
  { $sort: { createdDate: 1, orderNo: 1 } },
];
