const mongoose = require('mongoose');

const cashBoxSessionSchema = new mongoose.Schema({
  openedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  businessDate: {
    type: Date,
    required: true,
    default: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
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
    required: true
  }
});

module.exports = mongoose.model('CashBoxSession', cashBoxSessionSchema);
