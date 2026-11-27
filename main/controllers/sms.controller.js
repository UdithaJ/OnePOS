const smsCampaignService = require('../services/smsCampaign.service');

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  };
}

exports.getConfig = handle(async (req, res) => {
  res.json(smsCampaignService.getConfig());
});

exports.sendTest = handle(async (req, res) => {
  res.json(await smsCampaignService.sendTest(req.body || {}));
});

exports.listCampaigns = handle(async (req, res) => {
  res.json(await smsCampaignService.listCampaigns());
});

exports.createCampaign = handle(async (req, res) => {
  res.status(201).json(await smsCampaignService.createCampaign(req.body || {}));
});

exports.getCampaign = handle(async (req, res) => {
  res.json(await smsCampaignService.getCampaign(req.params.id));
});

exports.listRecipients = handle(async (req, res) => {
  res.json(await smsCampaignService.listRecipients(req.params.id, req.query));
});

exports.exportCsv = handle(async (req, res) => {
  const { filename, csv } = await smsCampaignService.exportCsv(req.params.id, req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens Sinhala/Tamil names correctly.
  res.send(`﻿${csv}`);
});

exports.pause = handle(async (req, res) => {
  res.json(await smsCampaignService.pauseCampaign(req.params.id));
});

exports.resume = handle(async (req, res) => {
  res.json(await smsCampaignService.resumeCampaign(req.params.id));
});

exports.cancel = handle(async (req, res) => {
  res.json(await smsCampaignService.cancelCampaign(req.params.id));
});

exports.remove = handle(async (req, res) => {
  res.json(await smsCampaignService.deleteCampaign(req.params.id));
});

exports.resend = handle(async (req, res) => {
  res.json(await smsCampaignService.resendCampaign(req.params.id, { includeUnknown: !!req.body?.includeUnknown }));
});
