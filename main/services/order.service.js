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
// A delivery date is a calendar day, not an instant. The date input sends
// 'YYYY-MM-DD', and Mongo stores that as UTC midnight — so comparing the day
// as text avoids the timezone shift that turns "today" into yesterday for
// anyone east or west of UTC. The shop is at +05:30, where that shift is real.
function toCalendarDay(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // A date-only value is stored as UTC midnight, so read the day back in UTC.
  return d.toISOString().slice(0, 10);
}

// Today where the shop is, not where the database thinks it is.
function todayCalendarDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// An order cannot be promised for a day that has already passed.
function assertDeliveryDateNotPast(value) {
  const day = toCalendarDay(value);
  if (!day) {
    const err = new Error('A delivery date is required.');
    err.status = 422;
    throw err;
  }
  if (day < todayCalendarDay()) {
    const err = new Error('The delivery date cannot be in the past.');
    err.status = 422;
    throw err;
  }
}

async function createOrder(orderData) {
  assertDeliveryDateNotPast(orderData.deliveryDate);

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
  createdDateFrom = '', createdDateTo = '', search = '', phone = ''
} = {}) {
  const skip = (page - 1) * limit
  const field = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'orderNo'
  const dir = sortOrder === 'asc' ? 1 : -1

  const filter = {}
  if (status && status.length) filter.status = { $in: status }
  // Date filters arrive as absolute ISO instants representing the client's local
  // start-of-day / end-of-day (see client utils/reportDate), so filter on them
  // directly rather than re-deriving day boundaries here.
  if (deliveryDateFrom || deliveryDateTo) {
    filter.deliveryDate = {}
    if (deliveryDateFrom) filter.deliveryDate.$gte = new Date(deliveryDateFrom)
    if (deliveryDateTo) filter.deliveryDate.$lte = new Date(deliveryDateTo)
  }
  // customerID (dropdown selection) and phone (text search) both narrow results
  // to specific customers. Resolve them into a single customerID filter: phone
  // is matched against the customers collection, then intersected with any
  // explicitly selected customer.
  let customerIdFilter = customerID ? [new mongoose.Types.ObjectId(customerID)] : null
  if (phone && phone.trim()) {
    const escaped = phone.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matched = await Customer.find({ mobileNumber: { $regex: escaped, $options: 'i' } })
      .select('_id').lean()
    const phoneIds = matched.map(c => c._id)
    customerIdFilter = customerIdFilter
      ? customerIdFilter.filter(id => phoneIds.some(p => String(p) === String(id)))
      : phoneIds
  }
  if (customerIdFilter) filter.customerID = { $in: customerIdFilter }
  if (createdDateFrom || createdDateTo) {
    filter.createdDate = {}
    if (createdDateFrom) filter.createdDate.$gte = new Date(createdDateFrom)
    if (createdDateTo) filter.createdDate.$lte = new Date(createdDateTo)
  }

  // Quick search matches the order number only (partial, case-insensitive).
  // Customer name / phone lookup is handled separately via the customerID filter.
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$expr = {
      $regexMatch: { input: { $toString: '$orderNo' }, regex: escaped, options: 'i' }
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
const Payment = require('../models/payment')

// models/user.js is an ES module, so the namespace comes back under .default.
const UserModule = require('../models/user')
const User = UserModule.default || UserModule

const orderWorkflow = require('../workflow/orderWorkflow')
const { loadTransitionTable } = require('./workflowStateMachine.service')

// The order state machine, as stored for entity 'order', falling back to the
// rules shipped in orderWorkflow when nothing is stored.
const loadOrderTransitions = () =>
  loadTransitionTable(orderWorkflow.ORDER_ENTITY, orderWorkflow.DEFAULT_TRANSITIONS)

// The acting user's role is read from the database, never taken from the
// request, so a caller cannot simply claim to be an admin. Note there is no
// session or token in this app: this stops the UI and a signed-in cashier, not
// a request crafted with a known admin's id.
async function resolveActingRole(actingUserId) {
  if (!actingUserId) return null;
  const actingUser = await User.findById(actingUserId);
  return actingUser ? actingUser.userRole : null;
}

// Every status the order form should offer, each marked allowed or not with the
// reason, so the form can disable the blocked ones instead of hiding them.
// Guards read the order's stored payment status here; the form is only deciding
// what to show, and updateOrder re-checks against the recomputed value on save.
async function getAllowedTransitions(orderId, actingUserId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  const [role, table] = await Promise.all([
    resolveActingRole(actingUserId),
    loadOrderTransitions(),
  ]);
  return {
    current: order.status,
    paymentStatus: order.paymentStatus,
    statuses: orderWorkflow.describeTargets(table, order.status, role, {
      paymentStatus: order.paymentStatus,
    }),
  };
}

// updateOrder runs in two phases. Everything that reads or calculates happens
// first, so a rejected status transition leaves the database untouched; only
// once the update is known to be valid does anything get written. Before this
// split the suborder rewrite ran first, so a later throw — a bad category id,
// and now a blocked transition — left the order pointing at deleted items.
async function updateOrder(id, updateData) {
  const order = await Order.findById(id);
  if (!order) throw new Error('Order not found');

  // Who is performing the update. Carried alongside the order fields the way
  // cash box sessions carry openedBy/closedBy, and removed before the update so
  // it is never written onto the order document.
  const actingUserId = updateData.actingUserId;
  delete updateData.actingUserId;

  // Only when the date is actually being moved. An order whose delivery date
  // has already passed is simply overdue, and must stay editable — rejecting
  // it here would make every overdue order impossible to save.
  if (updateData.deliveryDate !== undefined) {
    const proposed = toCalendarDay(updateData.deliveryDate);
    if (proposed && proposed !== toCalendarDay(order.deliveryDate)) {
      assertDeliveryDateNotPast(updateData.deliveryDate);
    }
  }

  // Detect transition into the 'done' status so we can notify the customer.
  // The !wasDone guard keeps this idempotent (re-saving a done order sends nothing).
  const wasDone = String(order.status) === 'done';
  const willBeDone = updateData.status === 'done';
  const justCompleted = willBeDone && !wasDone;

  // --- phase 1: compute, no writes -----------------------------------------

  // Planned suborder rows, worked out without touching the existing ones.
  let planned = null;
  let plannedTotal = null;

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

    // Work out each row's amount, reusing the original when category+weight
    // match, otherwise computing it. Nothing is created or deleted yet.
    planned = [];
    plannedTotal = 0;
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

      plannedTotal += amount;
      planned.push({ category: sub.category, weight: sub.weight, amount, order: id });
    }
  }

  // Totals and payment standing as they will be once this update lands. The
  // server's recomputed total wins over any total the client sent.
  const newTotal = plannedTotal ?? updateData.totalAmount ?? order.totalAmount
  const newDiscount = 'discount' in updateData
    ? Math.min(Math.max(Number(updateData.discount) || 0, 0), newTotal)
    : Number(order.discount || 0)
  const payments = await Payment.find({ orderId: id })
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const netTotal = Math.max(newTotal - newDiscount, 0)
  let paymentStatus = 'unpaid'
  if (paid <= 0) paymentStatus = 'unpaid'
  else if (paid >= netTotal && netTotal > 0) paymentStatus = 'paid'
  else if (paid > 0 && paid < netTotal) paymentStatus = 'partial'
  else if (netTotal === 0 && paid > 0) paymentStatus = 'paid'

  // Validate the status move against the workflow table. `undefined` means the
  // caller isn't touching status at all, and an unchanged value is not a
  // transition (the order form resends `status` on every save). The guards read
  // the payment status computed above, not the stored one, so a payment or
  // discount applied in this same save counts towards Delivered.
  if (updateData.status !== undefined && String(updateData.status) !== String(order.status)) {
    const [role, table] = await Promise.all([
      resolveActingRole(actingUserId),
      loadOrderTransitions(),
    ]);
    orderWorkflow.assertTransition(table, order.status, updateData.status, role, { paymentStatus });
  }

  // --- phase 2: commit ------------------------------------------------------

  if (planned) {
    // Replace the old suborders now that the update is known to be valid.
    if (Array.isArray(order.suborders) && order.suborders.length) {
      await OrderCategory.deleteMany({ _id: { $in: order.suborders } });
    }
    const suborderIds = [];
    for (const row of planned) {
      const suborder = new OrderCategory(row);
      await suborder.save();
      suborderIds.push(suborder._id);
    }
    updateData.suborders = suborderIds;
    updateData.totalAmount = plannedTotal;
  }

  updateData.discount = newDiscount
  updateData.dueAmount = Math.max(newTotal - newDiscount - paid, 0)
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
  toCalendarDay,
  todayCalendarDay,
  assertDeliveryDateNotPast,
  getAllowedTransitions,
  getOrderStatuses,
  createOrder,
  getAllOrders,
  getOrdersPaginated,
  getOrderById,
  updateOrder,
  deleteOrder,
  ORDER_STATUSES
};
