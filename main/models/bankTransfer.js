const mongoose = require('mongoose')

const bankTransferSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('BankTransfer', bankTransferSchema)
