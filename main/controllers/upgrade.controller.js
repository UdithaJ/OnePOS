const upgradeService = require('../services/upgrade.service');

// The script arrives as an ordinary JSON body: the browser reads the file and
// parses it, so there is no upload, no temporary file and no filename to
// handle. The server validates the object before anything reaches the database.

exports.previewUpgrade = async (req, res) => {
  try {
    const result = await upgradeService.previewUpgrade({
      script: req.body.script,
      actingUserId: req.body.actingUserId,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

exports.applyUpgrade = async (req, res) => {
  try {
    const result = await upgradeService.applyUpgrade({
      script: req.body.script,
      actingUserId: req.body.actingUserId,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    await upgradeService.assertMayRunUpgrades(req.query.actingUserId);
    res.json(await upgradeService.listHistory({ limit: req.query.limit }));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
