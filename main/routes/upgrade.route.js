const express = require('express');
const router = express.Router();
const upgradeController = require('../controllers/upgrade.controller');

// What a script would do, without writing anything.
router.post('/preview', upgradeController.previewUpgrade);

// Run it.
router.post('/apply', upgradeController.applyUpgrade);

// Everything recorded in applicationLog — seeds and upgrades alike.
router.get('/history', upgradeController.getHistory);

module.exports = router;
