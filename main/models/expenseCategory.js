const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['inflow', 'outflow'],
    required: true,
    default: 'outflow'
  }
});

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
