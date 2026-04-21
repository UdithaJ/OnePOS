const express = require('express');
const router = express.Router();
const cashBoxSessionController = require('../controllers/cashBoxSession.controller');

// Create a cash box session
router.post('/', cashBoxSessionController.createCashBoxSession);

// Update a cash box session (status)
router.patch('/:id', cashBoxSessionController.updateCashBoxSession);

// Get all cash box sessions
router.get('/', cashBoxSessionController.getAllCashBoxSessions);

// Get one cash box session
router.get('/:id', cashBoxSessionController.getCashBoxSessionById);

module.exports = router;
