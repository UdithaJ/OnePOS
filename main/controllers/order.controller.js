const Order = require('../models/order');
const orderService = require('../services/order.service');

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('customerID')
      .populate('status')
      .populate('categoryLines.categoryId');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get one order
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerID')
      .populate('status')
      .populate('categoryLines.categoryId');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create an order
exports.createOrder = async (req, res) => {
  try {
    const payload = await orderService.prepareOrderPayload(req.body);
    const order = new Order(payload);
    const newOrder = await order.save();
    await newOrder.populate([
      { path: 'customerID' },
      { path: 'status' },
      { path: 'categoryLines.categoryId' },
    ]);
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  try {
    let payload = req.body;
    if (req.body.categoryLines && Array.isArray(req.body.categoryLines)) {
      payload = await orderService.prepareOrderPayload(req.body);
    }
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    })
      .populate('customerID')
      .populate('status')
      .populate('categoryLines.categoryId');
    if (!updatedOrder) return res.status(404).json({ message: 'Order not found' });
    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
