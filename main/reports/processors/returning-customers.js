// Returning Customers — customers with more than N orders to date.
//
// The only report with no date range; its single `minOrderCount` parameter is
// why the engine treats a date range as one declarable param type rather than
// a built-in.

exports.buildPipeline = ({ params }) => {
  const threshold = Number(params.minOrderCount);
  const min = Number.isFinite(threshold) && threshold > 0 ? Math.floor(threshold) : 0;

  return [
    {
      $group: {
        _id: '$customerID',
        orderCount: { $sum: 1 },
        orderIds: { $push: '$_id' },
      },
    },
    { $match: { orderCount: { $gt: min } } },
    {
      $lookup: {
        from: 'ordercategories',
        localField: 'orderIds',
        foreignField: 'order',
        as: 'orderCategories',
      },
    },
    {
      $addFields: {
        totalWeight: { $sum: '$orderCategories.weight' },
      },
    },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: '$customer' },
    {
      $project: {
        _id: 0,
        customerId: '$_id',
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
        mobileNumber: '$customer.mobileNumber',
        orderCount: 1,
        totalWeight: 1,
      },
    },
    { $sort: { orderCount: -1, customerName: 1 } },
  ];
};
