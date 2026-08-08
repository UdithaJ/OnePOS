// Pending Orders by Due Date — one row per order/category line.

const ACTIVE_STATUSES = ['todo', 'done'];

exports.buildPipeline = ({ params }) => {
  const status = params.status && params.status !== 'all' ? [params.status] : ACTIVE_STATUSES;

  return [
    {
      $match: {
        deliveryDate: { $gte: params.fromDate, $lte: params.toDate },
        status: { $in: status },
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
        mobileNumber: '$customerDetail.mobileNumber',
        categoryName: '$categoryDetail.name',
        weight: '$suborders.weight',
      },
    },
    { $sort: { deliveryDate: 1, orderNo: 1 } },
  ];
};

exports.postProcess = (rows) => rows.map((row) => ({ ...row, orderId: String(row.orderId) }));
