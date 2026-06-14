const messagingService = require('../services/messaging.service');

exports.sendBulk = async (req, res) => {
  try {
    const { message, customerIds } = req.body;
    if (!message || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ message: 'message and customerIds are required' });
    }
    const result = await messagingService.sendBulkSms({ message, customerIds });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
