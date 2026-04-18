const Status = require('../models/status');

exports.getAllStatuses = async (req, res) => {
  try {
    const rows = await Status.find().sort({ displayName: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
