// Background sender for SMS campaigns.
//
// The recipients of every campaign in status "sending" form a queue in the
// database. This loop claims a few at a time, sends each through Notify.lk
// (one recipient per request), records the outcome, and pauses briefly before
// the next batch.
//
// Rules that keep a customer from getting the same SMS twice:
//   - A recipient is claimed by a single atomic update (pending -> sending), so
//     two OnePOS machines sharing the database never take the same one.
//   - Only failures where Notify.lk certainly did not process the request are
//     retried automatically. A timeout or an unexpected reply becomes
//     "unknown" and waits for a person to check the Notify.lk dashboard.
//   - A recipient left in "sending" by a crash or shutdown becomes "unknown"
//     for the same reason.
//
// The loop runs inside the app, so sending pauses while OnePOS is closed and
// carries on from the remaining recipients when it starts again.

const os = require('os');
const mongoose = require('mongoose');
const SmsCampaign = require('../models/smsCampaign');
const SmsRecipient = require('../models/smsRecipient');
const messaging = require('./messaging.service');

function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CONFIG = {
  // SMS sent in parallel per batch, and the pause between batches. Notify.lk
  // publishes no rate limit, so these start conservative (~2-3 SMS/second).
  concurrency: Math.min(positiveInt(process.env.SMS_CONCURRENCY, 3), 10),
  batchDelayMs: positiveInt(process.env.SMS_BATCH_DELAY_MS, 1000),
  maxAttempts: 3,
  retryBaseMs: 30 * 1000,
  idleMs: 3000,
  // Longer than any request can take (15s timeout), so a recipient still in
  // "sending" after this was abandoned by a stopped app, not one in progress.
  staleSendingMs: 2 * 60 * 1000,
  staleCheckEveryMs: 60 * 1000,
  abandonedDraftMs: 30 * 60 * 1000,
};

const WORKER_ID = `${os.hostname()}:${process.pid}`;

const STALE_REASON = 'The app stopped while this SMS was being sent, so it may already have gone out. Check the Notify.lk dashboard before resending.';
const UNKNOWN_SUFFIX = ' — it may still have been sent; check the Notify.lk dashboard before resending.';

// What to write to a recipient after one send attempt. Pure, for testing.
function decideUpdate(job, result, now = new Date(), config = CONFIG) {
  const base = { providerResponse: result.response ?? null, claimedBy: null };
  switch (result.outcome) {
    case 'accepted':
      return { set: { ...base, status: 'accepted', acceptedAt: now, reason: null, nextAttemptAt: null } };
    case 'rejected':
      return { set: { ...base, status: 'failed', reason: result.reason, nextAttemptAt: null } };
    case 'retry':
      if (job.attempts < config.maxAttempts) {
        const wait = config.retryBaseMs * 2 ** (job.attempts - 1);
        return { set: { ...base, status: 'retrying', reason: result.reason, nextAttemptAt: new Date(now.getTime() + wait) } };
      }
      return { set: { ...base, status: 'failed', reason: `${result.reason} (gave up after ${job.attempts} attempts)`, nextAttemptAt: null } };
    case 'halt':
      // Not this recipient's fault: put it back untouched and stop the campaign.
      return {
        set: { ...base, status: 'pending', attempts: Math.max(0, job.attempts - 1), reason: null, nextAttemptAt: null },
        haltReason: result.reason,
      };
    case 'unknown':
    default:
      return { set: { ...base, status: 'unknown', reason: `${result.reason || 'No clear reply from Notify.lk'}${UNKNOWN_SUFFIX}`, nextAttemptAt: null } };
  }
}

async function claimJob(campaignIds, now) {
  return SmsRecipient.findOneAndUpdate(
    {
      campaign: { $in: campaignIds },
      status: { $in: ['pending', 'retrying'] },
      $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    },
    { $set: { status: 'sending', claimedBy: WORKER_ID, claimedAt: now }, $inc: { attempts: 1 } },
    { sort: { _id: 1 }, new: true },
  );
}

async function pauseCampaign(campaignId, reason) {
  await SmsCampaign.updateOne(
    { _id: campaignId, status: 'sending' },
    { $set: { status: 'paused', pauseReason: reason } },
  );
}

async function processJob(job) {
  const result = await messaging.callNotify({ to: job.to, message: job.message });
  const { set, haltReason } = decideUpdate(job, result, new Date());
  await SmsRecipient.updateOne({ _id: job._id, status: 'sending' }, { $set: set });
  if (result.outcome !== 'accepted') {
    console.error(`[SMS campaign ${job.campaign}] ${job.to}: ${result.outcome} — ${result.reason}`);
  }
  if (haltReason) {
    await pauseCampaign(job.campaign, `Notify.lk refused the send: ${haltReason}`);
    // If the campaign was cancelled meanwhile, the returned job must not sit
    // in "pending" forever.
    const campaign = await SmsCampaign.findById(job.campaign).select('status').lean();
    if (campaign && campaign.status === 'cancelled') {
      await SmsRecipient.updateOne({ _id: job._id, status: 'pending' }, { $set: { status: 'cancelled' } });
    }
  }
}

// Marks a sending campaign completed once nothing is left to send.
async function completeFinished(campaignIds) {
  for (const id of campaignIds) {
    const open = await SmsRecipient.exists({ campaign: id, status: { $in: ['pending', 'retrying', 'sending'] } });
    if (!open) {
      await SmsCampaign.updateOne(
        { _id: id, status: 'sending' },
        { $set: { status: 'completed', completedAt: new Date(), pauseReason: null } },
      );
    }
  }
}

async function recoverStale() {
  const cutoff = new Date(Date.now() - CONFIG.staleSendingMs);
  const res = await SmsRecipient.updateMany(
    { status: 'sending', claimedAt: { $lt: cutoff } },
    { $set: { status: 'unknown', reason: STALE_REASON, claimedBy: null } },
  );
  if (res.modifiedCount) console.warn(`[SMS] ${res.modifiedCount} interrupted send(s) marked unknown`);

  // A campaign stays a draft only while its recipients are being written
  // (seconds). One older than this was abandoned by an app that stopped
  // mid-way; nothing was sent for it, so it is removed.
  const draftCutoff = new Date(Date.now() - CONFIG.abandonedDraftMs);
  const drafts = await SmsCampaign.find({ status: 'draft', createdAt: { $lt: draftCutoff } }).select('_id').lean();
  for (const d of drafts) {
    await removeCampaignData(d._id);
    console.warn(`[SMS] Removed abandoned draft campaign ${d._id}`);
  }

  // A delete runs in the background after the user confirms; if the app
  // stopped before it finished, finish it here.
  const deleteCutoff = new Date(Date.now() - CONFIG.staleSendingMs);
  const deleting = await SmsCampaign.find({ status: 'deleting', updatedAt: { $lt: deleteCutoff } }).select('_id').lean();
  for (const d of deleting) {
    await removeCampaignData(d._id);
    console.warn(`[SMS] Finished interrupted delete of campaign ${d._id}`);
  }
}

// Atlas Flex counts every deleted document as an operation and throttles
// above 500 ops/sec, so a campaign's recipients are removed 100 at a time with
// a pause — the same rate as creating them — and the campaign document last.
const REMOVE = { chunkSize: 100, pauseMs: 250 };

async function removeCampaignData(campaignId) {
  for (;;) {
    const batch = await SmsRecipient.find({ campaign: campaignId }).select('_id').limit(REMOVE.chunkSize).lean();
    if (!batch.length) break;
    await SmsRecipient.deleteMany({ _id: { $in: batch.map(r => r._id) } });
    if (batch.length < REMOVE.chunkSize) break;
    await sleep(REMOVE.pauseMs);
  }
  await SmsCampaign.deleteOne({ _id: campaignId });
}

// One batch. Returns true when something was sent, so the loop knows whether
// to pause briefly or idle.
async function runBatch() {
  const active = await SmsCampaign.find({ status: 'sending' }).select('_id').lean();
  if (!active.length) return false;
  const ids = active.map(c => c._id);

  if (!messaging.isConfigured()) {
    for (const id of ids) {
      await pauseCampaign(id, 'Notify.lk credentials are not configured (NOTIFY_USER_ID / NOTIFY_API_KEY).');
    }
    return false;
  }

  const now = new Date();
  const jobs = [];
  for (let i = 0; i < CONFIG.concurrency; i += 1) {
    const job = await claimJob(ids, now);
    if (!job) break;
    jobs.push(job);
  }

  await Promise.all(jobs.map(job => processJob(job).catch(err => {
    // The send may have happened; leave the recipient in "sending" so the
    // stale check turns it into "unknown" rather than risking a duplicate.
    console.error('[SMS] Failed to record result for', job.to, err.message || err);
  })));

  await completeFinished(ids);
  return jobs.length > 0;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let started = false;
let lastStaleCheck = 0;

async function loop() {
  for (;;) {
    let worked = false;
    try {
      if (mongoose.connection.readyState === 1) {
        if (Date.now() - lastStaleCheck >= CONFIG.staleCheckEveryMs) {
          lastStaleCheck = Date.now();
          await recoverStale();
        }
        worked = await runBatch();
      }
    } catch (err) {
      console.error('[SMS] Worker error:', err.message || err);
    }
    await sleep(worked ? CONFIG.batchDelayMs : CONFIG.idleMs);
  }
}

function start() {
  if (started) return;
  started = true;
  console.log(`[SMS] Campaign worker started (${CONFIG.concurrency} per batch, ${CONFIG.batchDelayMs}ms between batches)`);
  loop();
}

module.exports = { start, decideUpdate, removeCampaignData, CONFIG, REMOVE, STALE_REASON };
