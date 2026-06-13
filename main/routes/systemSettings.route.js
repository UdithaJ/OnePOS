const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettings.controller');

router.get('/', systemSettingsController.get);
router.put('/', systemSettingsController.update);

module.exports = router;
