const CashBoxSession = require('../models/cashBoxSession');
const { getSessionLedgerTotals } = require('./cashLedger.service');

exports.createCashBoxSession = async (data) => {
  const session = new CashBoxSession(data);
  return await session.save();
};

exports.updateCashBoxSession = async (id, data) => {
  // If closing, set status and closedAt
  const update = { ...data };
  if ((data.closingAmount !== undefined || data.closedBy !== undefined) && data.status !== 'open') {
    update.status = 'closed';
    update.closedAt = new Date();
  }
  return await CashBoxSession.findByIdAndUpdate(id, update, { new: true });
};

exports.getAllCashBoxSessions = async () => {
  return await CashBoxSession.find();
};

exports.getCashBoxSessionById = async (id) => {
  return await CashBoxSession.findById(id);
};

exports.getCashBoxSessionBalance = async (id) => {
  const session = await CashBoxSession.findById(id);
  if (!session) return null;

  const totals = await getSessionLedgerTotals(id);
  const openingAmount = Number(session.openingAmount || 0);
  const currentAmount =
    openingAmount +
    Number(totals.totalPayments || 0) +
    Number(totals.totalDeposits || 0) -
    Number(totals.totalExpenses || 0) -
    Number(totals.totalWithdrawals || 0);

  return {
    sessionId: session._id,
    openingAmount,
    totalPayments: Number(totals.totalPayments || 0),
    totalExpenses: Number(totals.totalExpenses || 0),
    totalDeposits: Number(totals.totalDeposits || 0),
    totalWithdrawals: Number(totals.totalWithdrawals || 0),
    currentAmount,
  };
};
