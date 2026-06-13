const systemSettingsService = require('../services/systemSettings.service');

exports.get = async (req, res) => {
  try {
    const settings = await systemSettingsService.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const settings = await systemSettingsService.updateSettings(req.body);
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
