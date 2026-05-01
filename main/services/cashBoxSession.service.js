const CashBoxSession = require('../models/cashBoxSession');

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
