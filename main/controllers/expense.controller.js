const Expense = require('../models/expense');

const { createCashLedger } = require('../services/cashLedger.service');

const REMARKS_REQUIRED = 'Bill number or Remarks required';

// A cash inflow must say where the money came from.
function remarksError(body) {
  if (body.flowType !== 'inflow') return null;
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
  return remarks ? null : REMARKS_REQUIRED;
}
exports.remarksError = remarksError;

exports.createExpense = async (req, res) => {
  try {
    const invalid = remarksError(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const expense = new Expense(req.body);
    await expense.save();

    // Create cash ledger record
    // sessionId and userId must be provided in req.body
    if (req.body.sessionId && req.body.userId) {
      const eventType = req.body.flowType === 'inflow' ? 'INFLOW' : 'EXPENSE';
      await createCashLedger({
        event_type: eventType,
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
