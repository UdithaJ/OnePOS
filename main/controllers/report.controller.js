const reportService = require('../services/report.service.js');

exports.getDailySalesReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getDailySalesReport(fromDate, toDate);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPendingOrdersByDueDate = async (req, res) => {
  try {
    const { fromDate, toDate, status } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getPendingOrdersByDueDate(fromDate, toDate, status);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBankTransferReconciliation = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getBankTransferReconciliation(fromDate, toDate);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getExpensesReport = async (req, res) => {
  try {
    const { fromDate, toDate, expenseTypeId } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getExpensesReport(fromDate, toDate, expenseTypeId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getReturningCustomers = async (req, res) => {
  try {
    const { minOrderCount } = req.query;
    const rows = await reportService.getReturningCustomers(minOrderCount ?? '0');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCashBoxSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getCashBoxSummary(fromDate, toDate);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBankTransferTracking = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }
    const rows = await reportService.getBankTransferTracking(fromDate, toDate);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
