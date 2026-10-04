// Bank Transfer Tracking — one row per bank payment, with the period chosen by
// dateBasis:
//
// - order (default) — orders created in the period, as the report always did.
// - payment — the payment's own date, so a transfer received today counts
//   today even for an order from last week.
// - business — the business day of the drawer session the payment was taken
//   in (see `shared/businessDay.js`).
//
// Rows are payment events, so Total Amount and Due Amount come from the
// snapshot frozen onto the payment, not from the live order — otherwise a later
// payment or an order edit silently rewrites an already-printed report. See
// `processors/cash-box-summary.js` for the same treatment.

const { resolveDateBasis, periodStages } = require('./shared/businessDay.js');

const ORDER_BASIS = 'order';

// 'payment' is this report's name for the shared 'transaction' basis.
function resolveBasis(value) {
  if (value === null || value === undefined || value === ORDER_BASIS) return ORDER_BASIS;
  if (value === 'payment') return 'transaction';
  if (value === 'business') return resolveDateBasis(value);
  const err = new Error('Parameter "dateBasis" must be one of: order, payment, business');
  err.status = 400;
  throw err;
}

exports.buildPipeline = ({ params }) => {
  const basis = resolveBasis(params.dateBasis);
  const byOrder = basis === ORDER_BASIS;

  return [
    { $match: { paymentMethod: 'bank' } },
    ...(byOrder
      ? []
      : periodStages({ basis, dateField: 'date', fromDate: params.fromDate, toDate: params.toDate })),
    {
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
    ...(byOrder
      ? [{ $match: { 'order.createdDate': { $gte: params.fromDate, $lte: params.toDate } } }]
      : []),
    {
      $lookup: {
        from: 'customers',
        localField: 'order.customerID',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        orderId: '$order._id',
        orderNo: '$order.orderNo',
        createdDate: '$order.createdDate',
        bankTransferDate: '$date',
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
        totalAmount: { $ifNull: ['$orderTotalAmount', '$order.totalAmount'] },
        dueAmount: { $ifNull: ['$dueAfter', '$order.dueAmount'] },
        bankTransferAmount: '$amount',
      },
    },
    { $sort: byOrder ? { createdDate: 1, orderNo: 1 } : { bankTransferDate: 1, orderNo: 1 } },
  ];
};
