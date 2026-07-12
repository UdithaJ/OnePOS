const CashLedger = require('../models/cashLedger');
const mongoose = require('mongoose');

async function createCashLedger(entry) {
  const ledger = new CashLedger(entry);
  return await ledger.save();
}

async function getSessionLedgerTotals(sessionId) {
  const [totals] = await CashLedger.aggregate([
    {
      $match: {
        sessionId: new mongoose.Types.ObjectId(sessionId),
      },
    },
    // Resolve each PAYMENT entry's method so cash and bank can be totalled
    // separately — bank transfers don't belong in the physical cash drawer.
    {
      $lookup: {
        from: 'payments',
        localField: 'source_id',
        foreignField: '_id',
        as: '_payment',
      },
    },
    {
      $addFields: {
        _paymentMethod: { $arrayElemAt: ['$_payment.paymentMethod', 0] },
      },
    },
    {
      $group: {
        _id: null,
        totalCashPayments: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$event_type', 'PAYMENT'] }, { $ne: ['$_paymentMethod', 'bank'] }] },
              '$amount',
              0,
            ],
          },
        },
        totalBankPayments: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$event_type', 'PAYMENT'] }, { $eq: ['$_paymentMethod', 'bank'] }] },
              '$amount',
              0,
            ],
          },
        },
        totalExpenses: {
          $sum: {
            $cond: [{ $eq: ['$event_type', 'EXPENSE'] }, '$amount', 0],
          },
        },
        totalDeposits: {
          $sum: {
            $cond: [{ $eq: ['$event_type', 'DEPOSIT'] }, '$amount', 0],
          },
        },
        totalWithdrawals: {
          $sum: {
            $cond: [{ $eq: ['$event_type', 'WITHDRAWAL'] }, '$amount', 0],
          },
        },
        totalInflows: {
          $sum: {
            $cond: [{ $eq: ['$event_type', 'INFLOW'] }, '$amount', 0],
          },
        },
      },
    },
  ]);

  const totalCashPayments = totals?.totalCashPayments || 0;
  const totalBankPayments = totals?.totalBankPayments || 0;
  return {
    // totalPayments reflects the cash drawer only; bank transfers are reported
    // separately via totalBankPayments and must not affect the physical balance.
    totalPayments: totalCashPayments,
    totalCashPayments,
    totalBankPayments,
    totalExpenses: totals?.totalExpenses || 0,
    totalDeposits: totals?.totalDeposits || 0,
    totalWithdrawals: totals?.totalWithdrawals || 0,
    totalInflows: totals?.totalInflows || 0,
  };
}

module.exports = {
  createCashLedger,
  getSessionLedgerTotals,
};
