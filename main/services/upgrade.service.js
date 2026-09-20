const ApplicationLog = require('../models/applicationLog');
const { preview, apply } = require('../upgrades/runner');
const { validateScript } = require('../upgrades/validate');
const { ROLES } = require('../constants/roles');

// models/user.js is an ES module, so the namespace arrives under .default.
const UserModule = require('../models/user');
const User = UserModule.default || UserModule;

function denied(message, status = 403) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Running an upgrade can rewrite any collection, so it is restricted to the
// built-in sysadmin. The role is read from the database rather than taken from
// the request — but there is no session or token in this application, so this
// stops the UI and a signed-in user, not a request crafted with a sysadmin id.
async function assertMayRunUpgrades(actingUserId) {
  if (!actingUserId) throw denied('Sign in as the system administrator to run upgrades.');
  const user = await User.findById(actingUserId).catch(() => null);
  if (!user) throw denied('Sign in as the system administrator to run upgrades.');
  if (user.userRole !== ROLES.SYSADMIN) {
    throw denied('Only the system administrator can run upgrades.');
  }
  return user;
}

async function alreadyApplied(action, version) {
  return await ApplicationLog.findOne({ action, version, status: 'success' }).lean();
}

// What the script would do. An already-applied script is reported rather than
// refused, so the screen can explain it instead of just failing.
async function previewUpgrade({ script, actingUserId }) {
  await assertMayRunUpgrades(actingUserId);
  const result = await preview(script);
  const applied = await alreadyApplied(result.action, result.version);
  return {
    ...result,
    alreadyApplied: !!applied,
    appliedAt: applied ? applied.runAt : null,
  };
}

async function applyUpgrade({ script, actingUserId }) {
  const actor = await assertMayRunUpgrades(actingUserId);
  const checked = validateScript(script);

  // Refused rather than skipped: someone who just uploaded a file expects to be
  // told why nothing happened.
  if (await alreadyApplied(checked.action, checked.version)) {
    throw denied(
      `"${checked.action}" version ${checked.version} has already been applied. ` +
      'Raise the version in the script if it is meant to run again.',
      409,
    );
  }

  const startedAt = Date.now();
  const { results } = await apply(script);
  const failed = results.filter(r => r.status === 'failed');
  const status = failed.length ? 'failed' : 'success';

  const summary = results
    .filter(r => r.status === 'applied')
    .map(r => {
      const counts = [
        r.inserted ? `${r.inserted} inserted` : null,
        r.modified !== undefined ? `${r.modified} modified` : null,
        r.deleted ? `${r.deleted} deleted` : null,
      ].filter(Boolean).join(', ');
      return `${r.op} ${r.collection}: ${counts || 'no change'}`;
    })
    .join('; ');

  const detail = failed.length
    ? `${results.length - failed.length} of ${checked.operations.length} operation(s) applied before failing: ${failed[0].error}`
    : (summary || 'no changes');

  const entry = await ApplicationLog.create({
    action: checked.action,
    version: checked.version,
    status,
    detail,
    durationMs: Date.now() - startedAt,
    payload: script,
    results,
    actedBy: actor._id,
  });

  return {
    action: checked.action,
    version: checked.version,
    status,
    detail,
    results,
    logId: entry._id,
    // A failure part-way leaves the earlier operations applied; there is no
    // transaction on a standalone mongod.
    partiallyApplied: status === 'failed' && results.some(r => r.status === 'applied'),
  };
}

// Everything the application has recorded about itself, newest first — the
// startup seeds as well as upgrades, since both are things done to this system.
async function listHistory({ limit = 50 } = {}) {
  const rows = await ApplicationLog.find()
    .sort({ runAt: -1 })
    .limit(Math.min(200, Math.max(1, parseInt(limit) || 50)))
    .lean();
  return rows.map(r => ({
    _id: r._id,
    action: r.action,
    version: r.version,
    status: r.status,
    detail: r.detail,
    runAt: r.runAt,
    durationMs: r.durationMs,
    isUpgrade: !!r.payload,
    results: r.results || null,
  }));
}

module.exports = { previewUpgrade, applyUpgrade, listHistory, assertMayRunUpgrades };
