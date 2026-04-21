const mongoose = require('mongoose');

const cashLedgerSchema = new mongoose.Schema({
  event_type: {
    type: String,
    enum: ['PAYMENT', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  source_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashBoxSession',
    required: true
  }
});

module.exports = mongoose.model('CashLedger', cashLedgerSchema);
