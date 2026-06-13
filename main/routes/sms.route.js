const express = require('express');
const router = express.Router();
const smsController = require('../controllers/sms.controller');

router.post('/bulk', smsController.sendBulk);

module.exports = router;
