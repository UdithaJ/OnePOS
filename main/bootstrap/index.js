// First-run data, applied when the application starts and the database is
// reachable.
//
// This is the only workable hook. The NSIS installer cannot do it: at install
// time MongoDB may not be running, may not be installed, and the connection
// string may not be right until someone edits .env. The scripts under
// main/scripts/ cannot do it either — they resolve .env relative to themselves,
// while a packaged build reads it from process.resourcesPath.
//
// What to seed lives in main/install/*.json, one file per step. A step is
// identified by (action, version) and recorded in the applicationLog ledger
// once it succeeds, so:
//   - it runs once, not on every launch,
//   - raising a file's version makes it run again on existing databases,
//   - a failure is retried next launch rather than recorded as done.
//
// Nothing here may prevent the application from starting. Everything seeded has
// a working fallback (the workflow rules fall back to the same JSON in code).

const fs = require('fs');
const path = require('path');
const ApplicationLog = require('../models/applicationLog');

// Models a seed file is allowed to write to. A whitelist rather than requiring
// a path named in the file, so a seed file can never point at arbitrary code.
const MODELS = {
  WorkflowStateMachine: require('../models/workflowStateMachine'),
  SystemSettings: require('../models/systemSettings'),
};

const INSTALL_DIR = path.join(__dirname, '..', 'install');

// Current state, served by GET /api/bootstrap/status so the window can show
// progress instead of appearing to hang on a slow first run.
const state = {
  state: 'pending',   // pending | seeding | ready | failed
  justSeeded: false,  // true only on the run that actually wrote something
  steps: [],
};

function getStatus() {
  return { ...state, steps: state.steps.map(s => ({ ...s })) };
}

function readSeedFiles() {
  if (!fs.existsSync(INSTALL_DIR)) return [];
  return fs.readdirSync(INSTALL_DIR)
    .filter(f => f.endsWith('.json'))
    .sort() // 001-, 002-, ... run in order
    .map(f => JSON.parse(fs.readFileSync(path.join(INSTALL_DIR, f), 'utf8')));
}

// Insert the documents this seed describes that aren't already there.
// `match` names the fields identifying a document; an empty match means the
// documents are only written when the collection is empty (a singleton).
async function applySeed(seed) {
  const Model = MODELS[seed.model];
  if (!Model) throw new Error(`seed names unknown model "${seed.model}"`);

  if (!seed.match || seed.match.length === 0) {
    if (await Model.countDocuments()) return 0;
    await Model.create(seed.documents);
    return seed.documents.length;
  }

  let inserted = 0;
  for (const doc of seed.documents) {
    const query = Object.fromEntries(seed.match.map(k => [k, doc[k]]));
    if (await Model.findOne(query).lean()) continue;
    try {
      await Model.create(doc);
      inserted += 1;
    } catch (err) {
      // Another instance inserted the same document between the check and the
      // write; the collection's unique index caught it.
      if (err && err.code === 11000) continue;
      throw err;
    }
  }
  return inserted;
}

async function alreadyRun(seed) {
  return !!(await ApplicationLog.findOne({
    action: seed.action,
    version: seed.version ?? 1,
    status: 'success',
  }).lean());
}

async function record(seed, status, detail, durationMs) {
  try {
    await ApplicationLog.create({
      action: seed.action,
      version: seed.version ?? 1,
      status,
      detail,
      durationMs,
    });
  } catch (err) {
    // A successful row already exists — another instance won the race. Fine.
    if (!(err && err.code === 11000)) throw err;
  }
}

async function runBootstrap() {
  state.state = 'seeding';
  state.steps = [];
  let seededAnything = false;
  let anyFailed = false;

  let seeds;
  try {
    seeds = readSeedFiles();
  } catch (err) {
    console.error(`[bootstrap] could not read install files: ${err.message}`);
    state.state = 'failed';
    return getStatus();
  }

  for (const seed of seeds) {
    const step = { action: seed.action, version: seed.version ?? 1, status: 'pending', detail: '' };
    state.steps.push(step);
    const startedAt = Date.now();
    try {
      if (await alreadyRun(seed)) {
        step.status = 'skipped';
        step.detail = 'already applied';
        continue;
      }
      const inserted = await applySeed(seed);
      const durationMs = Date.now() - startedAt;
      step.status = 'applied';
      step.detail = inserted ? `${inserted} document(s) added` : 'nothing to add';
      if (inserted) seededAnything = true;
      // Recorded only after the work succeeded, so a crash mid-seed retries.
      await record(seed, 'success', step.detail, durationMs);
      console.log(`[bootstrap] ${seed.action} v${step.version}: ${step.detail}`);
    } catch (err) {
      anyFailed = true;
      step.status = 'failed';
      step.detail = err.message;
      console.error(`[bootstrap] ${seed.action} failed: ${err.message}`);
      try {
        await record(seed, 'failed', err.message, Date.now() - startedAt);
      } catch { /* the ledger is best-effort when the step itself failed */ }
    }
  }

  state.justSeeded = seededAnything;
  state.state = anyFailed ? 'failed' : 'ready';
  return getStatus();
}

module.exports = { runBootstrap, getStatus };
