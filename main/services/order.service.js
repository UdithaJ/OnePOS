// Order service with hardcoded status list
const mongoose = require('mongoose');
const Order = require('../models/order');
const OrderCategory = require('../models/orderCategory');
const Category = require('../models/category');

// Hardcoded status list
const ORDER_STATUSES = [
  { name: 'todo', displayName: 'To Do' },
  { name: 'in_progress', displayName: 'In Progress' },
  { name: 'completed', displayName: 'Completed' },
  { name: 'cancelled', displayName: 'Cancelled' },
  { name: 'delivered', displayName: 'Delivered' }
];

// Authoritative suborder amount: max(weight * unitPrice, minimumPrice).
function computeAmount(weight, category) {
  const w = Number(weight) || 0;
  if (w === 0) return 0;
  const computed = w * Number(category.unitPrice);
  const floor = Number(category.minimumPrice) || 0;
  return Math.max(computed, floor);
}

async function loadCategoryMap(suborders) {
  const ids = (suborders || []).map(s => s.category).filter(Boolean);
  const cats = await Category.find({ _id: { $in: ids } });
  return new Map(cats.map(c => [String(c._id), c]));
}

// Example: get status list
function getOrderStatuses() {
  return ORDER_STATUSES;
}

// Example: create order (status defaults to 'To Do')
async function createOrder(orderData) {
  // TODO: Replace with actual logged-in user ID
  const createdUser = '000000000000000000000000';

  const catMap = await loadCategoryMap(orderData.suborders);

  // Step 1: Determine next sequential orderNo, then create the order without suborders.
  const last = await Order.findOne().sort({ orderNo: -1 }).select('orderNo').lean()
  const nextOrderNo = last && last.orderNo ? Number(last.orderNo) + 1 : 1

  const order = new Order({
    ...orderData,
    suborders: [],
    totalAmount: 0,
    dueAmount: 0,
    createdUser,
    status: 'todo',
    orderNo: nextOrderNo
  });
  await order.save();

  // Step 2: Create suborders, applying the minimum-price floor authoritatively.
  const suborderIds = [];
  let recomputedTotal = 0;
  if (Array.isArray(orderData.suborders)) {
    for (const sub of orderData.suborders) {
      const cat = catMap.get(String(sub.category));
      if (!cat) throw new Error(`Category ${sub.category} not found`);
      const amount = computeAmount(sub.weight, cat);
      recomputedTotal += amount;

      const suborder = new OrderCategory({
        order: order._id,
        category: sub.category,
        weight: sub.weight,
        amount
      });
      await suborder.save();
      suborderIds.push(suborder._id);
    }
  }

  // Step 3: Persist suborder IDs and the authoritative totals.
  order.suborders = suborderIds;
  order.totalAmount = recomputedTotal;
  order.dueAmount = recomputedTotal;
  await order.save();

  // Step 4: Populate suborders for return
  await order.populate({
    path: 'suborders',
    populate: { path: 'category' }
  });
  return order;
}

// Get all orders (kept for internal/report use)
async function getAllOrders() {
  return await Order.find().populate({
    path: 'suborders',
    populate: { path: 'category' }
  });
}

const SORTABLE_FIELDS = new Set(['orderNo', 'deliveryDate', 'status', 'totalAmount', 'createdDate', 'paymentStatus', 'customer'])

async function getOrdersPaginated({
  page = 1, limit = 10, sortBy = 'orderNo', sortOrder = 'desc',
  status = [], deliveryDateFrom = '', deliveryDateTo = '', customerID = '',
  createdDateFrom = '', createdDateTo = ''
} = {}) {
  const skip = (page - 1) * limit
  const field = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'orderNo'
  const dir = sortOrder === 'asc' ? 1 : -1

  const filter = {}
  if (status && status.length) filter.status = { $in: status }
  if (deliveryDateFrom || deliveryDateTo) {
    filter.deliveryDate = {}
    if (deliveryDateFrom) filter.deliveryDate.$gte = new Date(deliveryDateFrom)
    if (deliveryDateTo) {
      const end = new Date(deliveryDateTo)
      end.setHours(23, 59, 59, 999)
      filter.deliveryDate.$lte = end
    }
  }
  if (customerID) filter.customerID = new mongoose.Types.ObjectId(customerID)
  if (createdDateFrom || createdDateTo) {
    filter.createdDate = {}
    if (createdDateFrom) filter.createdDate.$gte = new Date(createdDateFrom)
    if (createdDateTo) {
      const end = new Date(createdDateTo)
      end.setHours(23, 59, 59, 999)
      filter.createdDate.$lte = end
    }
  }

  // Customer sort — lookup customer name from the customers collection
  if (field === 'customer') {
    const [orders, total] = await Promise.all([
      Order.aggregate([
        { $match: filter },
        { $lookup: { from: 'customers', localField: 'customerID', foreignField: '_id', as: '_cust' } },
        { $addFields: { _sortName: { $concat: [
          { $ifNull: [{ $arrayElemAt: ['$_cust.firstName', 0] }, ''] },
          ' ',
          { $ifNull: [{ $arrayElemAt: ['$_cust.lastName', 0] }, ''] }
        ] } } },
        { $sort: { _sortName: dir } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _cust: 0, _sortName: 0 } }
      ]),
      Order.countDocuments(filter)
    ])
    return { orders, total, page, limit }
  }

  // paymentStatus sort — alphabetical order is wrong (paid < partial < unpaid),
  // so use a numeric proxy: unpaid=0, partial=1, paid=2
  if (field === 'paymentStatus') {
    const [orders, total] = await Promise.all([
      Order.aggregate([
        { $match: filter },
        { $addFields: { _ps: { $switch: {
          branches: [
            { case: { $eq: ['$paymentStatus', 'unpaid']  }, then: 0 },
            { case: { $eq: ['$paymentStatus', 'partial'] }, then: 1 },
            { case: { $eq: ['$paymentStatus', 'paid']    }, then: 2 }
          ],
          default: -1
        } } } },
        { $sort: { _ps: dir } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _ps: 0 } }
      ]),
      Order.countDocuments(filter)
    ])
    return { orders, total, page, limit }
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [field]: dir })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'suborders', populate: { path: 'category' } }),
    Order.countDocuments(filter)
  ])
  return { orders, total, page, limit }
}

// Get order by ID
async function getOrderById(id) {
  return await Order.findById(id).populate({
    path: 'suborders',
    populate: { path: 'category' }
  });
}

// Update order
async function updateOrder(id, updateData) {
  if (Array.isArray(updateData.suborders)) {
    const catMap = await loadCategoryMap(updateData.suborders);

    // Remove old suborders
    const order = await Order.findById(id);
    if (order && Array.isArray(order.suborders)) {
      await OrderCategory.deleteMany({ _id: { $in: order.suborders } });
    }

    // Create new suborders with authoritative amounts.
    const suborderIds = [];
    let recomputedTotal = 0;
    for (const sub of updateData.suborders) {
      const cat = catMap.get(String(sub.category));
      if (!cat) throw new Error(`Category ${sub.category} not found`);
      const amount = computeAmount(sub.weight, cat);
      recomputedTotal += amount;

      const suborder = new OrderCategory({
        category: sub.category,
        weight: sub.weight,
        amount,
        order: id
      });
      await suborder.save();
      suborderIds.push(suborder._id);
    }
    updateData.suborders = suborderIds;
    updateData.totalAmount = recomputedTotal;
    // dueAmount intentionally left alone — payments may already exist.
  }
  return await Order.findByIdAndUpdate(id, updateData, { new: true }).populate({
    path: 'suborders',
    populate: { path: 'category' }
  });
}

// Delete order
async function deleteOrder(id) {
  return await Order.findByIdAndDelete(id);
}

module.exports = {
  getOrderStatuses,
  createOrder,
  getAllOrders,
  getOrdersPaginated,
  getOrderById,
  updateOrder,
  deleteOrder,
  ORDER_STATUSES
};
