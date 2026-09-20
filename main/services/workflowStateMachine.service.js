const WorkflowStateMachine = require('../models/workflowStateMachine');
const { rowsToTable } = require('../workflow/orderWorkflow');

// Loads one entity's state machine from the workflowStateMachine collection
// into the nested shape the workflow functions expect:
//
//   { todo: { done: {}, cancelled: { roles: ['admin'] } }, ... }
//
// `fallback` is the rules as shipped in code, used when the collection holds
// nothing for this entity or cannot be read. Falling back keeps the application
// behaving exactly as the built-in rules describe; failing closed would stop
// every status change in the shop, and failing open would drop the rules
// entirely.
//
// No cache. A status change is a human action in a single-terminal shop, so one
// small query per save is cheap — and a cache would mean an admin changing a
// rule and not seeing it take effect, which is a miserable thing to debug.
async function loadTransitionTable(entity, fallback) {
  let rows;
  try {
    rows = await WorkflowStateMachine.find({ entity, enabled: true }).lean();
  } catch (err) {
    console.warn(
      `[workflow] could not read workflowStateMachine for "${entity}" (${err.message}) — using the built-in rules`
    );
    return fallback;
  }

  // Nothing stored for this entity falls back rather than locking it down.
  // After the bootstrap seed has run on startup this should not happen; it
  // covers the window before it completes and a database that cannot be
  // written to. Withdraw a transition with enabled:false — a deleted row is
  // reinstated the next time the seed runs.
  if (!rows.length) {
    console.warn(`[workflow] no stored transitions for "${entity}" — using the built-in rules`);
    return fallback;
  }

  return rowsToTable(rows);
}

module.exports = { loadTransitionTable };
