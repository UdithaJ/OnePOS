const mongoose = require('mongoose');

const cashBoxSessionSchema = new mongoose.Schema({
  openedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  openingAmount: {
    type: Number,
    required: true
  },
  closedAt: {
    type: Date
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closingAmount: {
    type: Number
  }
});

module.exports = mongoose.model('CashBoxSession', cashBoxSessionSchema);
