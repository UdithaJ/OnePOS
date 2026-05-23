const Payment = require('../models/payment');

const { createCashLedger } = require('../services/cashLedger.service');

const Order = require('../models/order');
exports.createPayment = async (req, res) => {
  try {
    // Backend validation: prevent overpayment
    const orderId = req.body.orderId;
    const order = await Order.findById(orderId);
    if (!order) return res.status(400).json({ message: 'Order not found' });
    const Payment = require('../models/payment');
    const payments = await Payment.find({ orderId });
    const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const due = order.totalAmount - paid;
    if (Number(req.body.amount) > due) {
      return res.status(400).json({ message: 'Payment exceeds due amount.' });
    }
    const payment = new Payment(req.body);
    await payment.save();

    // Create cash ledger record
    if (req.body.sessionId && req.body.userId) {
      await createCashLedger({
        event_type: 'PAYMENT',
        date: new Date(),
        amount: payment.amount,
        userId: req.body.userId,
        source_id: payment._id,
        sessionId: req.body.sessionId
      });
    }

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getPaymentsByOrder = async (req, res) => {
  try {
    const payments = await Payment.find({ orderId: req.params.orderId });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
