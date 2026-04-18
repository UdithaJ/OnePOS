// Order service with hardcoded status list
const mongoose = require('mongoose');
const Order = require('../models/order');

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
  const order = new Order({
    ...orderData,
    dueAmount: orderData.totalAmount,
    createdUser,
    status: 'todo' // default status
  });
  return await order.save();
}

// Get all orders
async function getAllOrders() {
  return await Order.find();
}

// Get order by ID
async function getOrderById(id) {
  return await Order.findById(id);
}

// Update order
async function updateOrder(id, updateData) {
  return await Order.findByIdAndUpdate(id, updateData, { new: true });
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
