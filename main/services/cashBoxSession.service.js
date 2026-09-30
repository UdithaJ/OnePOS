const CashBoxSession = require('../models/cashBoxSession');
const { getSessionLedgerTotals } = require('./cashLedger.service');

// The session's cash on hand. The live balance and the closing amount both use
// this, so a session showing a balance closes at that same balance.
function computeSessionBalance(openingAmount, totals) {
  return (
    Number(openingAmount || 0) +
    Number(totals.totalPayments || 0) +
    Number(totals.totalDeposits || 0) +
    Number(totals.totalInflows || 0) -
    Number(totals.totalExpenses || 0) -
    Number(totals.totalWithdrawals || 0)
  );
}
exports.computeSessionBalance = computeSessionBalance;

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
    const session = await CashBoxSession.findById(id);
    if (!session) throw new Error('Cash box session not found');

    // Validate the closing time falls after the session's start time
    const closedAt = data.closedAt ? new Date(data.closedAt) : new Date();
    const openedAt = new Date(session.openedAt);
    if (!(closedAt > openedAt)) {
      throw new Error('Closing time must be after the session start time.');
    }

    update.status = 'closed';
    update.closedAt = closedAt;

    // Compute from ledger totals only when no closing amount was sent. Zero is a
    // real closing amount (a session can end with an empty box) and is saved as is.
    if (update.closingAmount === undefined || update.closingAmount === null || update.closingAmount === '') {
      const totals = await getSessionLedgerTotals(id);
      update.closingAmount = computeSessionBalance(session.openingAmount, totals);
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
  const currentAmount = computeSessionBalance(openingAmount, totals);

  return {
    sessionId: session._id,
    openingAmount,
    totalPayments: Number(totals.totalPayments || 0),
    totalBankPayments: Number(totals.totalBankPayments || 0),
    totalExpenses: Number(totals.totalExpenses || 0),
    totalDeposits: Number(totals.totalDeposits || 0),
    totalWithdrawals: Number(totals.totalWithdrawals || 0),
    totalInflows: Number(totals.totalInflows || 0),
    currentAmount,
  };
};
