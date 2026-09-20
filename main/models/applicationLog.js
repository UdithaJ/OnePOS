const mongoose = require('mongoose');

// A record of things the application has done to itself — today the install
// seeds, and deliberately general enough to carry other audit entries later.
//
// For seeding this is a migration ledger rather than a single "installed" flag:
// a step is identified by (action, version), so raising a seed's version makes
// it run once more on databases that already exist. A row is written only after
// the step succeeds, so a failure is retried on the next start rather than
// being recorded as done.
const applicationLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    trim: true,
  },
  version: {
    type: Number,
    required: true,
    default: 1,
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
  },
  detail: {
    type: String,
  },
  runAt: {
    type: Date,
    default: Date.now,
  },
  durationMs: {
    type: Number,
  },
}, {
  collection: 'applicationLog',
});

// Also the concurrency guard: if two terminals start at once, both may find the
// step unrecorded, but only one can write the row.
applicationLogSchema.index(
  { action: 1, version: 1 },
  { unique: true, partialFilterExpression: { status: 'success' } }
);

module.exports = mongoose.model('ApplicationLog', applicationLogSchema);
