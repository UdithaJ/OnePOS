const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  expenseType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  // Bill number or a note. Required for cash inflows (checked when the entry
  // is created), optional for expenses.
  remarks: {
    type: String,
    trim: true
  }
});

module.exports = mongoose.model('Expense', expenseSchema);
