const Order = require('../models/order');
const orderService = require('../services/order.service');
const capacityService = require('../services/capacity.service');

// Get orders (paginated + filtered)
exports.getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const sortBy = req.query.sortBy || 'orderNo'
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc'

    const rawStatus = req.query.status || ''
    const status = rawStatus ? rawStatus.split(',').map(s => s.trim()).filter(Boolean) : []
    const deliveryDateFrom = req.query.deliveryDateFrom || ''
    const deliveryDateTo = req.query.deliveryDateTo || ''
    const customerID = req.query.customerID || ''
    const createdDateFrom = req.query.createdDateFrom || ''
    const createdDateTo = req.query.createdDateTo || ''
    const search = req.query.search || ''
    const phone = req.query.phone || ''

    const result = await orderService.getOrdersPaginated({
      page, limit, sortBy, sortOrder,
      status, deliveryDateFrom, deliveryDateTo, customerID,
      createdDateFrom, createdDateTo, search, phone
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get one order
exports.getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create an order using orderService
exports.createOrder = async (req, res) => {
  try {
    const newOrder = await orderService.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get order status list
exports.getOrderStatuses = (req, res) => {
  res.json(orderService.getOrderStatuses());
};

// Capacity advisory check for a prospective order
exports.checkCapacity = async (req, res) => {
  try {
    const { deliveryDate, weightKg } = req.body || {};
    if (!deliveryDate) return res.status(400).json({ message: 'deliveryDate is required' });
    const result = await capacityService.checkCapacity({
      deliveryDate,
      newOrderKg: weightKg
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  try {
    const updatedOrder = await orderService.updateOrder(req.params.id, req.body);
    if (!updatedOrder) return res.status(404).json({ message: 'Order not found' });
    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await orderService.deleteOrder(req.params.id);
    if (!deletedOrder) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
