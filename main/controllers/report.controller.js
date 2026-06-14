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
