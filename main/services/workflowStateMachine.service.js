const WorkflowStateMachine = require('../models/workflowStateMachine');

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

  // Nothing stored for this entity falls back rather than locking it down. Note
  // this cannot be told apart from a deliberately emptied machine: to withdraw a
  // transition set enabled:false or delete that row, don't empty the entity.
  if (!rows.length) {
    console.warn(
      `[workflow] no stored transitions for "${entity}" — using the built-in rules. ` +
      'Run: node main/scripts/seedWorkflowStateMachine.js'
    );
    return fallback;
  }

  const table = {};
  for (const row of rows) {
    if (!table[row.from]) table[row.from] = {};
    const rule = {};
    if (row.roles && row.roles.length) rule.roles = row.roles;
    if (row.guards && row.guards.length) rule.guards = row.guards;
    table[row.from][row.to] = rule;
  }
  return table;
}

module.exports = { loadTransitionTable };
