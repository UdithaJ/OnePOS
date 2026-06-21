const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller.js');

router.get('/daily-sales', reportController.getDailySalesReport);
router.get('/pending-orders', reportController.getPendingOrdersByDueDate);
router.get('/bank-reconciliation', reportController.getBankTransferReconciliation);
router.get('/expenses', reportController.getExpensesReport);
router.get('/returning-customers', reportController.getReturningCustomers);
router.get('/cash-box-summary', reportController.getCashBoxSummary);
router.get('/bank-transfer-tracking', reportController.getBankTransferTracking);

module.exports = router;
