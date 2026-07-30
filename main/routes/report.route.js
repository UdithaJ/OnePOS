const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller.js');

// Two endpoints serve every report. Adding a report means adding a definition
// file under reports/definitions/ — no route, controller or service change.
router.get('/', reportController.listReports);
router.get('/:id', reportController.runReport);

module.exports = router;
