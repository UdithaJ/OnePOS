const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');

// Create an expense
router.post('/', expenseController.createExpense);

module.exports = router;
