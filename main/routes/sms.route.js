const express = require('express');
const router = express.Router();
const smsController = require('../controllers/sms.controller');

router.get('/config', smsController.getConfig);
router.post('/test', smsController.sendTest);

router.get('/campaigns', smsController.listCampaigns);
router.post('/campaigns', smsController.createCampaign);
router.get('/campaigns/:id', smsController.getCampaign);
router.delete('/campaigns/:id', smsController.remove);
router.get('/campaigns/:id/recipients', smsController.listRecipients);
router.get('/campaigns/:id/export', smsController.exportCsv);
router.post('/campaigns/:id/pause', smsController.pause);
router.post('/campaigns/:id/resume', smsController.resume);
router.post('/campaigns/:id/cancel', smsController.cancel);
router.post('/campaigns/:id/resend', smsController.resend);

module.exports = router;
