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
  }
});

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
