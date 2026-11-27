const mongoose = require('mongoose');

// A bulk SMS send. Its recipients (one SmsRecipient per customer) are the
// queue the background worker drains — see services/smsWorker.js.
//
// status:
//   draft     - recipients still being written; the worker ignores it
//   sending   - the worker is sending its pending recipients
//   paused    - by the user, or automatically on an account-level refusal
//               (pauseReason says which)
//   completed - nothing left to send
//   cancelled - stopped; unsent recipients were marked cancelled
//   deleting  - the user deleted it; hidden while its recipients are removed
const smsCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  senderId: { type: String },
  status: {
    type: String,
    enum: ['draft', 'sending', 'paused', 'completed', 'cancelled', 'deleting'],
    default: 'draft',
    index: true,
  },
  pauseReason: { type: String, default: null },
  createdBy: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SmsCampaign', smsCampaignSchema);
