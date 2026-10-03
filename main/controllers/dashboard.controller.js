const dashboardService = require('../services/dashboard.service');

// Order counts, pending weight and today's weight by category
exports.getSummary = async (req, res) => {
  try {
    const { dayStart, dayEnd } = req.query;
    res.json(await dashboardService.getSummary({ dayStart, dayEnd }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Order count per month for the last 3, 6 or 12 months
exports.getMonthlyOrderCount = async (req, res) => {
  try {
    const { months, tz } = req.query;
    res.json(await dashboardService.getMonthlyOrderCount({ months, tz }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Done and paid orders waiting to be delivered
exports.getDeliveryPending = async (req, res) => {
  try {
    res.json(await dashboardService.getDeliveryPending());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
