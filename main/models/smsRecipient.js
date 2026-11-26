const mongoose = require('mongoose');

// One SMS in a campaign. Name, number and the rendered message are copied in
// when the campaign is created, so later edits to the customer do not change
// what was sent or to whom.
//
// status:
//   pending   - waiting to be sent
//   retrying  - a send was not processed by Notify.lk; tried again at nextAttemptAt
//   sending   - claimed by a worker, request in flight
//   accepted  - Notify.lk accepted it (delivery to the handset is not reported)
//   failed    - refused, or retries exhausted
//   unknown   - may or may not have been sent (timeout, or the app stopped
//               mid-send); never retried automatically, to avoid duplicates
//   skipped   - never sent: invalid number, duplicate number, too long
//   cancelled - campaign cancelled before it was sent
const smsRecipientSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsCampaign', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  name: { type: String },
  mobileNumber: { type: String },
  to: { type: String },
  message: { type: String },
  status: {
    type: String,
    enum: ['pending', 'retrying', 'sending', 'accepted', 'failed', 'unknown', 'skipped', 'cancelled'],
    default: 'pending',
  },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: null },
  reason: { type: String, default: null },
  providerResponse: { type: mongoose.Schema.Types.Mixed },
  claimedBy: { type: String, default: null },
  claimedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true });

smsRecipientSchema.index({ campaign: 1, status: 1 });
smsRecipientSchema.index({ status: 1, nextAttemptAt: 1 });
smsRecipientSchema.index({ status: 1, claimedAt: 1 });

module.exports = mongoose.model('SmsRecipient', smsRecipientSchema);
