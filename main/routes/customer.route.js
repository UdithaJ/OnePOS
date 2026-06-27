
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const otpController = require('../controllers/otp.controller');


// Get all customers
router.get('/', customerController.getAllCustomers);

// Send OTP to verify mobile before creating customer
router.post('/send-otp', otpController.sendOtp);

// Verify OTP and create customer
router.post('/verify-otp', otpController.verifyOtp);

// Get one customer
router.get('/:id', customerController.getCustomerById);

// Create a customer
router.post('/', customerController.createCustomer);

// Update a customer
router.put('/:id', customerController.updateCustomer);

// Delete a customer
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
