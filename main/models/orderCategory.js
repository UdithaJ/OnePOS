const mongoose = require('mongoose');

const orderCategorySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  // Charged amount, rounded to the nearest 10.
  amount: {
    type: Number,
    required: true
  },
  // The unrounded weight × price (or minimum price), kept for reference.
  // Missing on items placed before rounding was introduced.
  actualAmount: {
    type: Number
  }
});

module.exports = mongoose.model('OrderCategory', orderCategorySchema);