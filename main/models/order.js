const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  suborders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderCategory',
    required: true
  }],
  createdDate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'completed', 'cancelled'],
    default: 'todo',
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
  },
  rackNumber: {
    type: String
  }
});

module.exports = mongoose.model('Order', orderSchema);
