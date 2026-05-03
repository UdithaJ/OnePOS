const Payment = require('../models/payment');

const { createCashLedger } = require('../services/cashLedger.service');

exports.createPayment = async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();

    // Create cash ledger record
    // sessionId and userId must be provided in req.body
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
