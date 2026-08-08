// Daily Sales — one row per order/category line.
//
// Grouping (date → order), the per-date total and the grand total are NOT here:
// they are declared in definitions/daily-sales.json and computed by the engine,
// so the table and the exports cannot disagree.

exports.buildPipeline = ({ params }) => [
  {
    $match: {
      createdDate: { $gte: params.fromDate, $lte: params.toDate },
    },
  },
  {
    $lookup: {
      from: 'ordercategories',
      localField: '_id',
      foreignField: 'order',
      as: 'suborders',
    },
  },
  { $unwind: '$suborders' },
  {
    $lookup: {
      from: 'categories',
      localField: 'suborders.category',
      foreignField: '_id',
      as: 'categoryDetail',
    },
  },
  { $unwind: '$categoryDetail' },
  {
    $lookup: {
      from: 'customers',
      localField: 'customerID',
      foreignField: '_id',
      as: 'customerDetail',
    },
  },
  { $unwind: '$customerDetail' },
  {
    $project: {
      _id: 0,
      orderId: '$_id',
      orderNo: 1,
      createdDate: 1,
      deliveryDate: 1,
      status: 1,
      rackNumber: 1,
      customerName: {
        $concat: [
          '$customerDetail.firstName',
          {
            $cond: [
              { $ifNull: ['$customerDetail.lastName', false] },
              { $concat: [' ', '$customerDetail.lastName'] },
              '',
            ],
          },
        ],
      },
      categoryName: '$categoryDetail.name',
      weight: '$suborders.weight',
      amount: '$suborders.amount',
      totalAmount: 1,
      discount: { $ifNull: ['$discount', 0] },
    },
  },
  { $sort: { createdDate: 1, orderNo: 1 } },
];

// netAmount is order-level, repeated on every line of the order — the engine's
// `distinctBy: "order"` is what stops it being summed once per line.
exports.postProcess = (rows) =>
  rows.map((row) => ({
    ...row,
    orderId: String(row.orderId),
    netAmount: row.totalAmount - row.discount,
  }));
