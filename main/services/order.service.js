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
  { name: 'cancelled', displayName: 'Cancelled' }
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

  // Step 1: Create the order without suborders. totalAmount/dueAmount are
  // recomputed below from the floored suborder amounts.
  const order = new Order({
    ...orderData,
    suborders: [],
    totalAmount: 0,
    dueAmount: 0,
    createdUser,
    status: 'todo'
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

// Get all orders
async function getAllOrders() {
  return await Order.find().populate({
    path: 'suborders',
    populate: { path: 'category' }
  });
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
  getOrderById,
  updateOrder,
  deleteOrder,
  ORDER_STATUSES
};
