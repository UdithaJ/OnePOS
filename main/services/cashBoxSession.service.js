const CashBoxSession = require('../models/cashBoxSession');
const { getSessionLedgerTotals } = require('./cashLedger.service');

exports.createCashBoxSession = async (data) => {
  // Prevent creating a new session when there's an active open session
  const active = await CashBoxSession.findOne({ status: 'open' });
  if (active) {
    throw new Error('An active cash box session already exists. Close it before starting a new one.');
  }

  // Get the most recent closed session to derive opening amount and validate timestamps
  const lastClosed = await CashBoxSession.findOne({ status: 'closed' }).sort({ closedAt: -1 });

  // Determine the openedAt that will be used (client-provided or now)
  const newOpenedAt = data.openedAt ? new Date(data.openedAt) : new Date();
  if (lastClosed) {
    const lastClosedAt = new Date(lastClosed.closedAt);
    if (!(newOpenedAt > lastClosedAt)) {
      throw new Error('Session start must be after the most recently closed session.');
    }
  }

  // Always set openingAmount to the last closed session's closingAmount
  const openingAmount = Number((lastClosed && lastClosed.closingAmount) || 0);
  const payload = { ...data, openingAmount };
  const session = new CashBoxSession(payload);
  return await session.save();
};

exports.updateCashBoxSession = async (id, data) => {
  // If closing, set status and closedAt
  const update = { ...data };

  const isClosing = (data.closingAmount !== undefined || data.closedBy !== undefined) && data.status !== 'open';
  if (isClosing) {
    update.status = 'closed';
    update.closedAt = new Date();

    // If closingAmount not provided or is 0, compute from ledger totals to avoid saving 0
    if (update.closingAmount === undefined || update.closingAmount === null || Number(update.closingAmount) === 0) {
      const session = await CashBoxSession.findById(id);
      const totals = await getSessionLedgerTotals(id);
      const openingAmount = Number(session?.openingAmount || 0);
      const computed =
        openingAmount +
        Number(totals.totalPayments || 0) +
        Number(totals.totalDeposits || 0) -
        Number(totals.totalExpenses || 0) -
        Number(totals.totalWithdrawals || 0);
      update.closingAmount = Number(computed || 0);
    }
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
    Number(totals.totalDeposits || 0) +
    Number(totals.totalInflows || 0) -
    Number(totals.totalExpenses || 0) -
    Number(totals.totalWithdrawals || 0);

  return {
    sessionId: session._id,
    openingAmount,
    totalPayments: Number(totals.totalPayments || 0),
    totalExpenses: Number(totals.totalExpenses || 0),
    totalDeposits: Number(totals.totalDeposits || 0),
    totalWithdrawals: Number(totals.totalWithdrawals || 0),
    totalInflows: Number(totals.totalInflows || 0),
    currentAmount,
  };
};
