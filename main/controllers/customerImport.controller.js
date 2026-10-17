const customerImportService = require('../services/customerImport.service');

// The CSV arrives as text in an ordinary JSON body: the browser reads the file,
// so there is no upload, no temporary file and no filename to handle.

exports.previewImport = async (req, res) => {
  try {
    const result = await customerImportService.previewImport({
      csv: req.body.csv,
      actingUserId: req.body.actingUserId,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

exports.applyImport = async (req, res) => {
  try {
    const result = await customerImportService.applyImport({
      csv: req.body.csv,
      actingUserId: req.body.actingUserId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message, details: err.details });
  }
};
