// Order service with hardcoded status list
const mongoose = require('mongoose');
const Order = require('../models/order');
const OrderCategory = require('../models/orderCategory');
const Category = require('../models/category');
const Customer = require('../models/customer');
const messaging = require('../services/messaging.service');

// Hardcoded status list
const ORDER_STATUSES = [
  { name: 'todo', displayName: 'To Do' },
  { name: 'done', displayName: 'Done' },
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
  const discount = Math.min(Math.max(Number(orderData.discount) || 0, 0), recomputedTotal)
  order.suborders = suborderIds;
  order.totalAmount = recomputedTotal;
  order.discount = discount;
  order.dueAmount = Math.max(recomputedTotal - discount, 0);
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
  createdDateFrom = '', createdDateTo = '', search = ''
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

  // Full-text search across orderNo, customer name, and customer phone
  if (search && search.trim()) {
    const s = search.trim()
    const searchOrConditions = [
      {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: [{ $arrayElemAt: ['$_cust.firstName', 0] }, ''] },
                ' ',
                { $ifNull: [{ $arrayElemAt: ['$_cust.lastName', 0] }, ''] }
              ]
            },
            regex: s, options: 'i'
          }
        }
      },
      { '_cust.mobileNumber': { $regex: s, $options: 'i' } }
    ]
    const searchNum = parseInt(s, 10)
    if (!isNaN(searchNum)) searchOrConditions.push({ orderNo: searchNum })

    const basePipeline = [
      { $match: filter },
      { $lookup: { from: 'customers', localField: 'customerID', foreignField: '_id', as: '_cust' } },
      { $match: { $or: searchOrConditions } }
    ]

    let sortStage
    if (field === 'customer') {
      sortStage = [
        { $addFields: { _sortName: { $concat: [
          { $ifNull: [{ $arrayElemAt: ['$_cust.firstName', 0] }, ''] },
          ' ',
          { $ifNull: [{ $arrayElemAt: ['$_cust.lastName', 0] }, ''] }
        ] } } },
        { $sort: { _sortName: dir } }
      ]
    } else if (field === 'paymentStatus') {
      sortStage = [
        { $addFields: { _ps: { $switch: {
          branches: [
            { case: { $eq: ['$paymentStatus', 'unpaid']  }, then: 0 },
            { case: { $eq: ['$paymentStatus', 'partial'] }, then: 1 },
            { case: { $eq: ['$paymentStatus', 'paid']    }, then: 2 }
          ],
          default: -1
        } } } },
        { $sort: { _ps: dir } }
      ]
    } else {
      sortStage = [{ $sort: { [field]: dir } }]
    }

    const [countResult, orders] = await Promise.all([
      Order.aggregate([...basePipeline, { $count: 'total' }]),
      Order.aggregate([
        ...basePipeline,
        ...sortStage,
        { $skip: skip },
        { $limit: limit },
        { $project: { _cust: 0, _sortName: 0, _ps: 0 } }
      ])
    ])
    return { orders, total: countResult[0]?.total ?? 0, page, limit }
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
const Payment = require('../models/payment')
async function updateOrder(id, updateData) {
  const order = await Order.findById(id);
  if (!order) throw new Error('Order not found');

  // Detect transition into the 'done' status so we can notify the customer.
  // The !wasDone guard keeps this idempotent (re-saving a done order sends nothing).
  const wasDone = String(order.status) === 'done';
  const willBeDone = updateData.status === 'done';
  const justCompleted = willBeDone && !wasDone;

  if (Array.isArray(updateData.suborders)) {
    // Disallow editing of order items if the order is finalized (Done or Delivered)
    if (['done', 'delivered'].includes(String(order.status))) {
      throw new Error('Cannot edit order items when order status is Done or Delivered');
    }

    const catMap = await loadCategoryMap(updateData.suborders);

    // Load existing suborders so we can preserve original amounts when appropriate
    const existingSuborders = Array.isArray(order.suborders) && order.suborders.length
      ? await OrderCategory.find({ _id: { $in: order.suborders } }).lean()
      : [];

    // Build a map of existing amounts keyed by category+weight so unchanged items keep original amount
    const existingMap = new Map();
    for (const ex of existingSuborders) {
      const key = `${String(ex.category)}_${String(ex.weight)}`;
      if (!existingMap.has(key)) existingMap.set(key, []);
      existingMap.get(key).push(Number(ex.amount || 0));
    }

    // Remove old suborders
    if (existingSuborders.length) {
      await OrderCategory.deleteMany({ _id: { $in: order.suborders } });
    }

    // Create new suborders, reusing original amounts when category+weight match, otherwise compute
    const suborderIds = [];
    let recomputedTotal = 0;
    for (const sub of updateData.suborders) {
      const cat = catMap.get(String(sub.category));
      if (!cat) throw new Error(`Category ${sub.category} not found`);

      const key = `${String(sub.category)}_${String(sub.weight)}`;
      let amount;
      if (existingMap.has(key) && existingMap.get(key).length > 0) {
        amount = existingMap.get(key).shift();
      } else {
        amount = computeAmount(sub.weight, cat);
      }

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
  }

  // Recalculate dueAmount whenever total or discount changes
  const newTotal = updateData.totalAmount ?? order.totalAmount
  const newDiscount = 'discount' in updateData
    ? Math.min(Math.max(Number(updateData.discount) || 0, 0), newTotal)
    : Number(order.discount || 0)
  updateData.discount = newDiscount
  const payments = await Payment.find({ orderId: id })
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  updateData.dueAmount = Math.max(newTotal - newDiscount - paid, 0)

  // Recalculate paymentStatus based on collected payments and new totals
  const netTotal = Math.max(newTotal - newDiscount, 0)
  let paymentStatus = 'unpaid'
  if (paid <= 0) paymentStatus = 'unpaid'
  else if (paid >= netTotal && netTotal > 0) paymentStatus = 'paid'
  else if (paid > 0 && paid < netTotal) paymentStatus = 'partial'
  else if (netTotal === 0 && paid > 0) paymentStatus = 'paid'
  updateData.paymentStatus = paymentStatus

  const updated = await Order.findByIdAndUpdate(id, updateData, { new: true }).populate({
    path: 'suborders',
    populate: { path: 'category' }
  });

  // Best-effort: notify the customer when the order has just been completed.
  // Not awaited so the response isn't delayed by the SMS gateway timeout, and any
  // failure is logged only — it must never fail the order update.
  if (justCompleted) {
    sendOrderCompletionSms(updated).catch(err =>
      console.error('[SMS] order-completion send failed', err?.message || err)
    );
  }

  return updated;
}

// Send a completion notification SMS to the order's customer (best-effort).
async function sendOrderCompletionSms(order) {
  const customer = await Customer.findById(order.customerID);
  if (!customer || !customer.mobileNumber) {
    console.warn(`[SMS] order ${order.orderNo}: no customer/mobile, skipping completion SMS`);
    return;
  }
  const greetName = [customer.title, customer.firstName].filter(Boolean).join(' ') || 'Customer';
  const message = `Dear ${greetName}, Your laundry is now ready for collection. Invoice #${order.orderNo}.\nThank you,\nSoftwash Laundry Mirihana.\nHotline: 0718 807 625`;
  await messaging.sendSms({ to: customer.mobileNumber, message });
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
