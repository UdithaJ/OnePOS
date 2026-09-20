
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');


// Get all orders
router.get('/', orderController.getAllOrders);

// Capacity advisory check (must come before /:id)
router.post('/check-capacity', orderController.checkCapacity);

// Get one order
router.get('/:id', orderController.getOrderById);

// Create an order
router.post('/', orderController.createOrder);

// Status options for an order (drives the form's status dropdown)
router.get('/:id/allowed-transitions', orderController.getAllowedTransitions);

// Update an order
router.put('/:id', orderController.updateOrder);

// Delete an order
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
