const Expense = require('../models/expense');

const { createCashLedger } = require('../services/cashLedger.service');

exports.createExpense = async (req, res) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();

    // Create cash ledger record
    // sessionId and userId must be provided in req.body
    if (req.body.sessionId && req.body.userId) {
      await createCashLedger({
        event_type: 'EXPENSE',
        date: new Date(),
        amount: expense.amount,
        userId: req.body.userId,
        source_id: expense._id,
        sessionId: req.body.sessionId
      });
    }

    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
