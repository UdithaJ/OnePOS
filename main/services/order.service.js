// Order service with hardcoded status list
const mongoose = require('mongoose');
const Order = require('../models/order');
const OrderCategory = require('../models/orderCategory');

// Hardcoded status list
const ORDER_STATUSES = [
  { name: 'todo', displayName: 'To Do' },
  { name: 'in_progress', displayName: 'In Progress' },
  { name: 'completed', displayName: 'Completed' },
  { name: 'cancelled', displayName: 'Cancelled' }
];

// Example: get status list
function getOrderStatuses() {
  return ORDER_STATUSES;
}

// Example: create order (status defaults to 'To Do')
async function createOrder(orderData) {
  // TODO: Replace with actual logged-in user ID
  const createdUser = '000000000000000000000000';
  // Step 1: Create the order without suborders
  const order = new Order({
    ...orderData,
    suborders: [],
    dueAmount: orderData.totalAmount,
    createdUser,
    status: 'todo' // default status
  });
  await order.save();

  // Step 2: Create suborders with the order._id
  const suborderIds = [];
  if (Array.isArray(orderData.suborders)) {
    for (const sub of orderData.suborders) {
      const suborder = new OrderCategory({
        order: order._id,
        category: sub.category,
        weight: sub.weight,
        amount: sub.amount
      });
      await suborder.save();
      suborderIds.push(suborder._id);
    }
  }

  // Step 3: Update the order with suborder IDs
  order.suborders = suborderIds;
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
  // Optionally update suborders
  if (Array.isArray(updateData.suborders)) {
    // Remove old suborders
    const order = await Order.findById(id);
    if (order && Array.isArray(order.suborders)) {
      await OrderCategory.deleteMany({ _id: { $in: order.suborders } });
    }
    // Create new suborders
    const suborderIds = [];
    for (const sub of updateData.suborders) {
      const suborder = new OrderCategory({
        category: sub.category,
        weight: sub.weight,
        amount: sub.amount,
        order: id
      });
      await suborder.save();
      suborderIds.push(suborder._id);
    }
    updateData.suborders = suborderIds;
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
