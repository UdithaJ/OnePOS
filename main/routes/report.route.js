const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller.js');

router.get('/daily-sales', reportController.getDailySalesReport);
router.get('/pending-orders', reportController.getPendingOrdersByDueDate);
router.get('/bank-reconciliation', reportController.getBankTransferReconciliation);

module.exports = router;
