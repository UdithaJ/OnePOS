const CashBoxSession = require('../models/cashBoxSession');

exports.createCashBoxSession = async (data) => {
  const session = new CashBoxSession(data);
  return await session.save();
};

exports.updateCashBoxSession = async (id, data) => {
  return await CashBoxSession.findByIdAndUpdate(id, data, { new: true });
};

exports.getAllCashBoxSessions = async () => {
  return await CashBoxSession.find();
};

exports.getCashBoxSessionById = async (id) => {
  return await CashBoxSession.findById(id);
};
