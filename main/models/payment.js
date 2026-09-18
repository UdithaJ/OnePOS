const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  type: {
    type: String,
    enum: ['advance', 'full_payment', 'settlement'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },

  // Snapshot of the order's money state at the moment this payment was taken.
  // Written server-side by the payment controller and never updated afterwards,
  // so a payment row in a historical report reproduces the figures that were
  // printed when the report was first run. Later payments and order edits move
  // the live order fields; they must not move these.
  // Absent on payments recorded before this was introduced — run
  // `node main/scripts/backfillPaymentSnapshots.js` to reconstruct them.
  orderTotalAmount: {
    type: Number
  },
  orderDiscount: {
    type: Number
  },
  dueBefore: {
    type: Number
  },
  dueAfter: {
    type: Number
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
