const mongoose = require('mongoose');
const Order = require('../models/order.js');
const Expense = require('../models/expense.js');

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

async function getPendingOrdersByDueDate(fromDate, toDate, status) {
  const start = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T23:59:59.999Z');
  const ACTIVE_STATUSES = ['todo', 'in_progress', 'completed'];
  const statusFilter = (status && status !== 'all') ? [status] : ACTIVE_STATUSES;

  const rows = await Order.aggregate([
    {
      $match: {
        deliveryDate: { $gte: start, $lte: end },
        status: { $in: statusFilter },
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
          $concat: ['$customerDetail.firstName', ' ', '$customerDetail.lastName'],
        },
        mobileNumber: '$customerDetail.mobileNumber',
        categoryName: '$categoryDetail.name',
        weight: '$suborders.weight',
      },
    },
    { $sort: { deliveryDate: 1, orderNo: 1 } },
  ]);

  return rows;
}

async function getBankTransferReconciliation(fromDate, toDate) {
  const start = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T23:59:59.999Z');

  const rows = await Expense.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $lookup: {
        from: 'expensecategories',
        localField: 'expenseType',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    { $match: { 'category.displayName': { $regex: /^bank deposite$/i } } },
    {
      $project: {
        _id: 0,
        expenseId: '$_id',
        date: 1,
        description: '$category.displayName',
        amount: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);

  return rows;
}

async function getExpensesReport(fromDate, toDate, expenseTypeId) {
  const start = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T23:59:59.999Z');

  const matchStage = { date: { $gte: start, $lte: end } };
  if (expenseTypeId && expenseTypeId !== 'all') {
    matchStage.expenseType = mongoose.Types.ObjectId.createFromHexString(expenseTypeId);
  }

  const rows = await Expense.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'expensecategories',
        localField: 'expenseType',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    { $match: { 'category.displayName': { $not: { $regex: /^bank deposite$/i } } } },
    {
      $project: {
        _id: 0,
        expenseId: '$_id',
        date: 1,
        description: '$category.displayName',
        amount: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);

  return rows;
}

module.exports = { getDailySalesReport, getPendingOrdersByDueDate, getBankTransferReconciliation, getExpensesReport };
