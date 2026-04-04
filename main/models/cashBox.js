const mongoose = require('mongoose');

const cashBoxSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true
  }
});

module.exports = mongoose.model('CashBox', cashBoxSchema);
