const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller.js');

router.get('/daily-sales', reportController.getDailySalesReport);

module.exports = router;
