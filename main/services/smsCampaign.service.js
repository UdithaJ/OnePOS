const mongoose = require('mongoose');
const Customer = require('../models/customer');
const SmsCampaign = require('../models/smsCampaign');
const SmsRecipient = require('../models/smsRecipient');
const messaging = require('./messaging.service');
const smsWorker = require('./smsWorker');

// Campaigns being written or being deleted are not shown anywhere.
const HIDDEN = ['draft', 'deleting'];

const STATUSES = ['pending', 'retrying', 'sending', 'accepted', 'failed', 'unknown', 'skipped', 'cancelled'];

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// --- message & recipient building (pure) -----------------------------------

// Same greeting the order-ready SMS uses: "Mr Nimal", else "Customer".
function greetingName(customer) {
  return [customer?.title, customer?.firstName].filter(Boolean).join(' ') || 'Customer';
}

function renderMessage(template, customer) {
  return String(template).replace(/\{name\}/gi, greetingName(customer));
}

// Character count as Notify.lk sees it (emoji count once).
function messageLength(text) {
  return [...String(text)].length;
}

// One row per selected customer. Rows that cannot be sent are kept as
// "skipped" with the reason, so the campaign shows why they got nothing.
function buildRecipients(customers, template) {
  const seen = new Map();
  return customers.map(c => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
    const to = messaging.toNotifyNumber(c.mobileNumber);
    const message = renderMessage(template, c);
    const row = { customer: c._id, name, mobileNumber: c.mobileNumber, to, message, status: 'pending', reason: null };
    if (!to) {
      return { ...row, status: 'skipped', reason: 'Not a valid Sri Lankan mobile number' };
    }
    if (seen.has(to)) {
      return { ...row, status: 'skipped', reason: `Duplicate number (also selected for ${seen.get(to) || 'another customer'})` };
    }
    seen.set(to, name);
    if (messageLength(message) > messaging.MAX_MESSAGE_LENGTH) {
      return { ...row, status: 'skipped', reason: `Message is longer than ${messaging.MAX_MESSAGE_LENGTH} characters` };
    }
    return row;
  });
}

// --- queries -----------------------------------------------------------------

function emptyCounts() {
  const counts = { total: 0 };
  for (const s of STATUSES) counts[s] = 0;
  return counts;
}

async function countsFor(campaignIds) {
  const rows = await SmsRecipient.aggregate([
    { $match: { campaign: { $in: campaignIds } } },
    { $group: { _id: { campaign: '$campaign', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byCampaign = new Map(campaignIds.map(id => [String(id), emptyCounts()]));
  for (const r of rows) {
    const counts = byCampaign.get(String(r._id.campaign));
    if (!counts) continue;
    counts[r._id.status] = r.n;
    counts.total += r.n;
  }
  return byCampaign;
}

function etaSeconds(counts) {
  const remaining = counts.pending + counts.retrying + counts.sending;
  if (!remaining) return 0;
  // The pause plus Notify.lk's reply and the database steps (~1.2s measured).
  const perBatch = smsWorker.CONFIG.batchDelayMs / 1000 + 1.2;
  return Math.ceil(remaining / smsWorker.CONFIG.concurrency) * perBatch;
}

function summarize(campaign, counts) {
  return { ...campaign, counts, etaSeconds: campaign.status === 'sending' ? etaSeconds(counts) : null };
}

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'Campaign not found');
}

async function loadCampaign(id) {
  assertId(id);
  const campaign = await SmsCampaign.findById(id).lean();
  if (!campaign || HIDDEN.includes(campaign.status)) throw httpError(404, 'Campaign not found');
  return campaign;
}

function getConfig() {
  return {
    configured: messaging.isConfigured(),
    senderId: messaging.credentials().sender_id,
    maxLength: messaging.MAX_MESSAGE_LENGTH,
    concurrency: smsWorker.CONFIG.concurrency,
    batchDelayMs: smsWorker.CONFIG.batchDelayMs,
  };
}

async function listCampaigns() {
  const campaigns = await SmsCampaign.find({ status: { $nin: HIDDEN } }).sort({ createdAt: -1 }).limit(200).lean();
  const counts = await countsFor(campaigns.map(c => c._id));
  return campaigns.map(c => summarize(c, counts.get(String(c._id))));
}

async function getCampaign(id) {
  const campaign = await loadCampaign(id);
  const counts = await countsFor([campaign._id]);
  return summarize(campaign, counts.get(String(campaign._id)));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recipientFilter(campaignId, { status, search } = {}) {
  const filter = { campaign: campaignId };
  const statuses = String(status || '').split(',').map(s => s.trim()).filter(s => STATUSES.includes(s));
  if (statuses.length) filter.status = { $in: statuses };
  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ name: rx }, { mobileNumber: rx }];
  }
  return filter;
}

async function listRecipients(id, query = {}) {
  const campaign = await loadCampaign(id);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const filter = recipientFilter(campaign._id, query);
  const [items, total] = await Promise.all([
    SmsRecipient.find(filter)
      .select('name mobileNumber status attempts reason updatedAt acceptedAt')
      .sort({ _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    SmsRecipient.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv(id, query = {}) {
  const campaign = await loadCampaign(id);
  const rows = await SmsRecipient.find(recipientFilter(campaign._id, query))
    .select('name mobileNumber status attempts reason updatedAt').sort({ _id: 1 }).lean();
  const lines = [['Customer', 'Mobile', 'Status', 'Attempts', 'Reason', 'Last updated']];
  for (const r of rows) {
    lines.push([r.name, r.mobileNumber, r.status, r.attempts, r.reason, r.updatedAt ? new Date(r.updatedAt).toISOString() : '']);
  }
  return { filename: `${campaign.name.replace(/[^\w-]+/g, '_')}-recipients.csv`, csv: lines.map(l => l.map(csvCell).join(',')).join('\r\n') };
}

// --- commands ------------------------------------------------------------------

// Atlas Flex counts every inserted document as an operation and throttles
// above 500 ops/sec, slowing every POS machine sharing the cluster. Writing a
// 3,000-customer campaign in one insertMany would burst far past that, so the
// rows go in chunks of 100 with a pause: at most ~400/sec even when the
// database answers instantly, less over Atlas (a 3,000-row campaign takes
// roughly 8-10 seconds to create).
const INSERT = { chunkSize: 100, pauseMs: 250 };

async function insertInChunks(docs) {
  for (let i = 0; i < docs.length; i += INSERT.chunkSize) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, INSERT.pauseMs));
    await SmsRecipient.insertMany(docs.slice(i, i + INSERT.chunkSize), { ordered: true });
  }
}

async function createCampaign({ name, message, customerIds, createdBy }) {
  if (!name || !String(name).trim()) throw httpError(400, 'Campaign name is required');
  if (!message || !String(message).trim()) throw httpError(400, 'Message is required');
  if (messageLength(message) > messaging.MAX_MESSAGE_LENGTH) {
    throw httpError(400, `Message must be ${messaging.MAX_MESSAGE_LENGTH} characters or fewer`);
  }
  if (!Array.isArray(customerIds) || customerIds.length === 0) throw httpError(400, 'Select at least one customer');

  const ids = [...new Set(customerIds.map(String))].filter(id => mongoose.isValidObjectId(id));
  const customers = await Customer.find({ _id: { $in: ids } }).lean();
  if (!customers.length) throw httpError(400, 'None of the selected customers were found');

  const recipients = buildRecipients(customers, message);
  if (!recipients.some(r => r.status === 'pending')) {
    throw httpError(400, 'None of the selected customers can be sent to (invalid or duplicate numbers)');
  }

  // Written as a draft, so the worker cannot see a half-written recipient list
  // and decide the campaign is finished.
  const campaign = await SmsCampaign.create({
    name: String(name).trim(),
    message,
    senderId: messaging.credentials().sender_id,
    createdBy: createdBy || null,
    status: 'draft',
  });
  try {
    await insertInChunks(recipients.map(r => ({ ...r, campaign: campaign._id })));
  } catch (err) {
    await smsWorker.removeCampaignData(campaign._id).catch(() => {});
    throw err;
  }
  await SmsCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'sending', startedAt: new Date() } });
  return getCampaign(campaign._id);
}

async function pauseCampaign(id) {
  const campaign = await loadCampaign(id);
  if (campaign.status !== 'sending') throw httpError(409, 'Only a campaign that is sending can be paused');
  await SmsCampaign.updateOne({ _id: campaign._id, status: 'sending' }, { $set: { status: 'paused', pauseReason: 'Paused by user' } });
  return getCampaign(id);
}

async function resumeCampaign(id) {
  const campaign = await loadCampaign(id);
  if (campaign.status !== 'paused') throw httpError(409, 'Only a paused campaign can be resumed');
  await SmsCampaign.updateOne({ _id: campaign._id, status: 'paused' }, { $set: { status: 'sending', pauseReason: null } });
  return getCampaign(id);
}

async function cancelCampaign(id) {
  const campaign = await loadCampaign(id);
  if (!['sending', 'paused'].includes(campaign.status)) throw httpError(409, 'This campaign is already finished');
  await SmsCampaign.updateOne(
    { _id: campaign._id },
    { $set: { status: 'cancelled', cancelledAt: new Date(), pauseReason: null } },
  );
  await SmsRecipient.updateMany(
    { campaign: campaign._id, status: { $in: ['pending', 'retrying'] } },
    { $set: { status: 'cancelled', nextAttemptAt: null } },
  );
  return getCampaign(id);
}

// Removes a campaign and its history. Not while it is sending (pause or
// cancel first), nor while an SMS of it is still in flight. The campaign is
// hidden at once; its rows are removed in the background at a rate Atlas Flex
// accepts, and the worker finishes the job if the app stops before then.
async function deleteCampaign(id) {
  const campaign = await loadCampaign(id);
  if (campaign.status === 'sending') {
    throw httpError(409, 'Pause or cancel the campaign before deleting it');
  }
  if (await SmsRecipient.exists({ campaign: campaign._id, status: 'sending' })) {
    throw httpError(409, 'An SMS from this campaign is still being sent. Try again in a few seconds.');
  }
  const res = await SmsCampaign.updateOne(
    { _id: campaign._id, status: campaign.status },
    { $set: { status: 'deleting' } },
  );
  if (!res.modifiedCount) throw httpError(409, 'The campaign changed meanwhile. Refresh and try again.');
  smsWorker.removeCampaignData(campaign._id).catch(err =>
    console.error('[SMS] Delete of campaign', String(campaign._id), 'interrupted; the worker will finish it:', err.message || err));
  return { deleted: true };
}

// Puts failed (and, when asked, unknown) recipients back in the queue.
async function resendCampaign(id, { includeUnknown = false } = {}) {
  const campaign = await loadCampaign(id);
  if (campaign.status === 'cancelled') throw httpError(409, 'A cancelled campaign cannot be resent');
  const statuses = includeUnknown ? ['failed', 'unknown'] : ['failed'];
  const res = await SmsRecipient.updateMany(
    { campaign: campaign._id, status: { $in: statuses } },
    { $set: { status: 'pending', attempts: 0, nextAttemptAt: null, reason: null, claimedBy: null, claimedAt: null } },
  );
  if (!res.modifiedCount) throw httpError(409, 'There is nothing to resend');
  // A paused campaign stays paused (the user resumes it); otherwise it starts sending.
  if (campaign.status !== 'paused') {
    await SmsCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'sending', completedAt: null, pauseReason: null } },
    );
  }
  return { ...(await getCampaign(id)), requeued: res.modifiedCount };
}

// A single SMS to the admin's own phone before sending to everyone.
async function sendTest({ to, message }) {
  if (!message || !String(message).trim()) throw httpError(400, 'Message is required');
  const number = messaging.toNotifyNumber(to);
  if (!number) throw httpError(400, 'Enter a valid Sri Lankan mobile number');
  const text = renderMessage(message, { firstName: 'Customer' });
  if (messageLength(text) > messaging.MAX_MESSAGE_LENGTH) {
    throw httpError(400, `Message must be ${messaging.MAX_MESSAGE_LENGTH} characters or fewer`);
  }
  const result = await messaging.callNotify({ to: number, message: text });
  return { ok: result.outcome === 'accepted', outcome: result.outcome, reason: result.reason };
}

module.exports = {
  STATUSES,
  INSERT,
  greetingName,
  renderMessage,
  buildRecipients,
  getConfig,
  listCampaigns,
  getCampaign,
  listRecipients,
  exportCsv,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  resendCampaign,
  deleteCampaign,
  sendTest,
};
