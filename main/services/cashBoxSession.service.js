const CashBoxSession = require('../models/cashBoxSession');

exports.createCashBoxSession = async (data) => {
  // Normalize businessDate to midnight (date-only semantics).
  const payload = { ...data };
  if (payload.businessDate) {
    const d = new Date(payload.businessDate);
    d.setHours(0, 0, 0, 0);
    payload.businessDate = d;
  }
  const session = new CashBoxSession(payload);
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
