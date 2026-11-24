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
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
    required: true,
    // The open session is looked up on most screens; one session is added per
    // business day, so without the index the lookup reads every one of them.
    index: true
  }
});

module.exports = mongoose.model('CashBoxSession', cashBoxSessionSchema);
