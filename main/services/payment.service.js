const Payment = require('../models/payment');

async function createPayment(paymentData) {
  const payment = new Payment(paymentData);
  return await payment.save();
}

async function getPaymentsByOrder(orderId) {
  return await Payment.find({ orderId });
}

module.exports = {
  createPayment,
  getPaymentsByOrder,
};
