const cashBoxSessionService = require('../services/cashBoxSession.service');

exports.createCashBoxSession = async (req, res) => {
  try {
    const session = await cashBoxSessionService.createCashBoxSession(req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateCashBoxSession = async (req, res) => {
  try {
    const session = await cashBoxSessionService.updateCashBoxSession(req.params.id, req.body);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllCashBoxSessions = async (req, res) => {
  try {
    const sessions = await cashBoxSessionService.getAllCashBoxSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCashBoxSessionById = async (req, res) => {
  try {
    const session = await cashBoxSessionService.getCashBoxSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
