const Payment = require('../models/payment');

// UNUSED — nothing in main/ or client/ requires this module; payments are
// written by `controllers/payment.controller.js`. Do not start using
// `createPayment` below as-is: it saves whatever it is handed, so it would
// produce payments with no money snapshot (orderTotalAmount / orderDiscount /
// dueBefore / dueAfter) and reintroduce the retroactive-report defect. Delete
// this file, or move the controller's snapshot logic into it, before wiring it
// up.

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
