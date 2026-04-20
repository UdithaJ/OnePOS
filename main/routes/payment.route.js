const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Create a payment
router.post('/', paymentController.createPayment);

// (Optional) Get all payments for an order
router.get('/order/:orderId', paymentController.getPaymentsByOrder);

module.exports = router;
