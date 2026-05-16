const Expense = require('../models/expense');

async function createExpense(expenseData) {
  const expense = new Expense(expenseData);
  return await expense.save();
}

module.exports = {
  createExpense,
};
