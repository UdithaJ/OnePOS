// Cash Box Summary (Cash Inflow) — one row per non-bank payment taken in the
// period, plus one row per cash inflow (an expense whose category is an
// inflow) recorded in it. The Type column tells them apart: payments read
// "Customer Payment", inflows carry their category name and leave the order
// and customer columns empty.
//
// The period is the payment's own date (or, with dateBasis=business, the
// business day of the drawer session it was taken in), never the order's
// creation date, so a settlement taken today counts today even for an order
// from last week. The Payment Date column always shows the payment's own date.
// Inflows follow the same rule on their own date.
//
// Each row is a payment *event*, so its money columns come from the snapshot
// frozen onto the payment when it was taken, not from the live order. Reading
// the order made every re-run show today's figures: settle an order and last
// month's report retroactively showed Due Amount 0. Payments predating the
// snapshot fall back to the order fields — run
// `node main/scripts/backfillPaymentSnapshots.js` to fill them in.
//
// The engine runs one aggregate per report, so the inflows are pulled in with
// $unionWith (MongoDB 4.4+) and sorted together with the payments.

const { resolveDateBasis, periodStages } = require('./shared/businessDay.js');

const inflowStages = (period) => [
  ...periodStages(period),
  {
    $lookup: {
      from: 'expensecategories',
      localField: 'expenseType',
      foreignField: '_id',
      as: 'category',
    },
  },
  { $unwind: '$category' },
  { $match: { 'category.type': 'inflow' } },
  {
    $project: {
      _id: 0,
      entryType: '$category.displayName',
      orderId: { $literal: null },
      orderNo: { $literal: null },
      createdDate: { $literal: null },
      paymentDate: '$date',
      customerName: { $literal: null },
      totalAmount: { $literal: null },
      discount: { $literal: null },
      orderAmountAfterDiscount: { $literal: null },
      dueAmount: { $literal: null },
      paymentMethod: { $literal: 'cash' },
      paymentReceived: '$amount',
    },
  },
];

exports.buildPipeline = ({ params }) => {
  const period = {
    basis: resolveDateBasis(params.dateBasis),
    dateField: 'date',
    fromDate: params.fromDate,
    toDate: params.toDate,
  };

  return [
    { $match: { paymentMethod: { $ne: 'bank' } } },
    ...periodStages(period),
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
        entryType: { $literal: 'Customer Payment' },
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
    { $unionWith: { coll: 'expenses', pipeline: inflowStages(period) } },
    { $sort: { paymentDate: 1, orderNo: 1 } },
  ];
};
