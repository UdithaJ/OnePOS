const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  status: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Status',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  createdUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  dueAmount: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('Order', orderSchema);
