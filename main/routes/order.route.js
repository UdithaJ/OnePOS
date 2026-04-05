
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');


// Get all orders
router.get('/', orderController.getAllOrders);

// Get one order
router.get('/:id', orderController.getOrderById);

// Create an order
router.post('/', orderController.createOrder);

// Update an order
router.put('/:id', orderController.updateOrder);

// Delete an order
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
