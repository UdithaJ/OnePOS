// Bank Transfer Tracking — bank payments against orders created in the period.

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
      totalAmount: 1,
      dueAmount: 1,
      bankTransferAmount: '$payments.amount',
    },
  },
  { $sort: { createdDate: 1, orderNo: 1 } },
];
