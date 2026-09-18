// Bank Transfer Tracking — bank payments against orders created in the period.
//
// Rows are payment events, so Total Amount and Due Amount come from the
// snapshot frozen onto the payment, not from the live order — otherwise a later
// payment or an order edit silently rewrites an already-printed report. See
// `processors/cash-box-summary.js` for the same treatment.

exports.buildPipeline = ({ params }) => [
  { $match: { createdDate: { $gte: params.fromDate, $lte: params.toDate } } },
  {
    $lookup: {
      from: 'payments',
      localField: '_id',
      foreignField: 'orderId',
      as: 'payments',
    },
  },
  { $unwind: '$payments' },
  { $match: { 'payments.paymentMethod': 'bank' } },
  {
    $lookup: {
      from: 'customers',
      localField: 'customerID',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      orderId: '$_id',
      orderNo: 1,
      createdDate: 1,
      bankTransferDate: '$payments.date',
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
      totalAmount: { $ifNull: ['$payments.orderTotalAmount', '$totalAmount'] },
      dueAmount: { $ifNull: ['$payments.dueAfter', '$dueAmount'] },
      bankTransferAmount: '$payments.amount',
    },
  },
  { $sort: { createdDate: 1, orderNo: 1 } },
];
