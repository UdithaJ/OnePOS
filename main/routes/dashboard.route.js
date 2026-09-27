const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard order figures and chart data
router.get('/summary', dashboardController.getSummary);

// Monthly order count chart (?months=3|6|12)
router.get('/monthly-orders', dashboardController.getMonthlyOrderCount);

// Orders ready to hand over
router.get('/delivery-pending', dashboardController.getDeliveryPending);

module.exports = router;
