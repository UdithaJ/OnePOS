// Cash Box Summary (Cash Inflow) — one row per non-bank payment taken in the
// period. The period is the payment's own date, not the order's creation date,
// so a settlement taken today counts today even for an order from last week.
//
// Each row is a payment *event*, so its money columns come from the snapshot
// frozen onto the payment when it was taken, not from the live order. Reading
// the order made every re-run show today's figures: settle an order and last
// month's report retroactively showed Due Amount 0. Payments predating the
// snapshot fall back to the order fields — run
// `node main/scripts/backfillPaymentSnapshots.js` to fill them in.

exports.buildPipeline = ({ params }) => [
  {
    $match: {
      date: { $gte: params.fromDate, $lte: params.toDate },
      paymentMethod: { $ne: 'bank' },
    },
  },
  {
    $lookup: {
      from: 'orders',
      localField: 'orderId',
      foreignField: '_id',
      as: 'order',
    },
  },
  { $unwind: '$order' },
  {
    $lookup: {
      from: 'customers',
      localField: 'order.customerID',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  // Resolve the frozen figures once; fall back to the live order for payments
  // recorded before snapshots existed.
  {
    $addFields: {
      frozenTotal: { $ifNull: ['$orderTotalAmount', '$order.totalAmount'] },
      frozenDiscount: { $ifNull: ['$orderDiscount', { $ifNull: ['$order.discount', 0] }] },
      frozenDue: { $ifNull: ['$dueAfter', '$order.dueAmount'] },
    },
  },
  {
    $project: {
      _id: 0,
      orderId: '$order._id',
      orderNo: '$order.orderNo',
      createdDate: '$order.createdDate',
      paymentDate: '$date',
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
      paymentMethod: 1,
      paymentReceived: '$amount',
    },
  },
  { $sort: { paymentDate: 1, orderNo: 1 } },
];
