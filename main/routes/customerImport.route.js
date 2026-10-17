const express = require('express');
const router = express.Router();
const customerImportController = require('../controllers/customerImport.controller');

// Check every row of the file, without writing anything.
router.post('/preview', customerImportController.previewImport);

// Create the customers — all of them, or none if any row has a problem.
router.post('/apply', customerImportController.applyImport);

module.exports = router;
