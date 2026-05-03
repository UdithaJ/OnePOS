const CashLedger = require('../models/cashLedger');

async function createCashLedger(entry) {
  const ledger = new CashLedger(entry);
  return await ledger.save();
}

module.exports = {
  createCashLedger,
};
