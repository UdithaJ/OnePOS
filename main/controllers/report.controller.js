const { runReport, listDefinitions } = require('../reports/engine/index.js');

// Catalog — drives the Reports menu in the client nav.
exports.listReports = async (req, res) => {
  try {
    res.json(listDefinitions());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Runs any report by id. Replaces the seven per-report handlers; parameter
// validation now comes from each report's definition rather than being
// hand-written here.
exports.runReport = async (req, res) => {
  try {
    const envelope = await runReport(req.params.id, req.query);
    res.json(envelope);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
