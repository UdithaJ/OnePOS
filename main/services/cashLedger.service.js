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
    {
      $group: {
        _id: null,
        totalPayments: {
          $sum: {
            $cond: [{ $eq: ['$event_type', 'PAYMENT'] }, '$amount', 0],
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

  return {
    totalPayments: totals?.totalPayments || 0,
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
