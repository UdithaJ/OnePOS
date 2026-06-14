const Order = require('../models/order.js');

async function getDailySalesReport(fromDate, toDate) {
  const start = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T23:59:59.999Z');

  const rows = await Order.aggregate([
    {
      $match: {
        createdDate: { $gte: start, $lte: end },
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
          $concat: ['$customerDetail.firstName', ' ', '$customerDetail.lastName'],
        },
        categoryName: '$categoryDetail.name',
        weight: '$suborders.weight',
        amount: '$suborders.amount',
      },
    },
    { $sort: { createdDate: 1, orderNo: 1 } },
  ]);

  return rows;
}

module.exports = { getDailySalesReport };
