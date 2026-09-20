// Deciding whether an order may move from one status to another.
//
// The rules live in the workflowStateMachine collection under entity 'order',
// loaded by workflowStateMachine.service.js. Everything here is pure and takes
// the table as an
// argument, so the decision logic stays testable without a database and only
// one module knows where the rules are stored. DEFAULT_TRANSITIONS below is
// both the seed for that collection and the fallback when it cannot be read.
//
// These rules used to be split between order.service.js (item edits blocked on
// done/delivered) and OrderList.vue (`isOrderFullyLocked`, the hardcoded status
// list), which meant the two could disagree — and did: the UI treated Delivered
// as terminal while the API happily moved a delivered order back to To Do.
// Now the service enforces the table and the form asks the server what to
// offer, so the two cannot drift apart.
//
// Reading a table: table[from][to] exists when the move is permitted at all.
// `roles` (when present and non-empty) names who may perform it; `guards` names
// conditions the order must satisfy, resolved against workflow/guards.js and
// checked against the state the order will be in once the update is applied —
// not the state it is in now. Staying on the same status is always allowed: the
// order form resends `status` on every save, so an unchanged value must never
// be treated as a transition.

// The entity this machine belongs to, as stored in the workflowStateMachine
// collection.
const ORDER_ENTITY = 'order';

const ORDER_STATUS_VALUES = ['todo', 'done', 'cancelled', 'delivered'];

const ORDER_STATUS_LABELS = {
  todo: 'To Do',
  done: 'Done',
  cancelled: 'Cancelled',
  delivered: 'Delivered',
};

const { GUARDS } = require('./guards');

// The rules as shipped, read from the same file the installer seeds into the
// database (main/install/001-workflowStateMachine.json). One definition serves
// both, so the seed and the fallback cannot drift apart.
const seedFile = require('../install/001-workflowStateMachine.json');

// Rows -> the nested { from: { to: rule } } shape. Used for the shipped rules
// here and for the stored rows in workflowStateMachine.service.js, so both go
// through the same conversion.
function rowsToTable(rows, entity) {
  const table = {};
  for (const row of rows) {
    if (entity && row.entity !== entity) continue;
    if (row.enabled === false) continue;
    if (!table[row.from]) table[row.from] = {};
    const rule = {};
    if (row.roles && row.roles.length) rule.roles = row.roles;
    if (row.guards && row.guards.length) rule.guards = row.guards;
    table[row.from][row.to] = rule;
  }
  return table;
}

const DEFAULT_TRANSITIONS = rowsToTable(seedFile.documents, ORDER_ENTITY);

function normalize(status) {
  return String(status ?? '').trim().toLowerCase();
}

function isKnownStatus(status) {
  return ORDER_STATUS_VALUES.includes(normalize(status));
}

function transitionError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function label(status) {
  return ORDER_STATUS_LABELS[normalize(status)] || status;
}

// A stored rule naming a guard this build doesn't have is refused rather than
// ignored: the row exists to impose a condition, and skipping it would drop
// that condition silently.
function unknownGuard(name, to) {
  console.warn(`[workflow] transition to "${to}" names unknown guard "${name}" — refusing the move`);
  return transitionError(
    `The rule for ${label(to)} refers to an unknown condition ("${name}"). Please contact support.`,
    422,
  );
}

// Returns { allowed, error } rather than throwing, so callers that are building
// a list of options (describeTargets) don't pay for exceptions. `table` is the
// transition table, `context` carries the order state the guards read, e.g.
// { paymentStatus }.
function canTransition(table, from, to, role, context = {}) {
  const f = normalize(from);
  const t = normalize(to);

  if (!isKnownStatus(f)) return { allowed: false, error: transitionError(`Unknown order status "${from}".`, 422) };
  if (!isKnownStatus(t)) return { allowed: false, error: transitionError(`Unknown order status "${to}".`, 422) };

  // A status that is not changing is not a transition.
  if (f === t) return { allowed: true };

  const rule = (table[f] || {})[t];
  if (!rule) {
    return {
      allowed: false,
      error: transitionError(`An order cannot move from ${label(f)} to ${label(t)}.`, 422),
    };
  }

  if (rule.roles && rule.roles.length && !rule.roles.includes(role)) {
    const who = rule.roles.map(r => `${r} users`).join(' or ');
    return {
      allowed: false,
      // 403: the move is legal, this user may not make it.
      error: transitionError(`Only ${who} can change an order to ${label(t)}.`, 403),
    };
  }

  for (const name of rule.guards || []) {
    const guard = GUARDS[name];
    if (!guard) return { allowed: false, error: unknownGuard(name, t) };
    if (!guard.check(context)) {
      // 422: anyone may make this move, but the order isn't in a fit state yet.
      return { allowed: false, error: transitionError(guard.message, 422) };
    }
  }

  return { allowed: true };
}

function assertTransition(table, from, to, role, context = {}) {
  const { allowed, error } = canTransition(table, from, to, role, context);
  if (!allowed) throw error;
}

// Every status this role may set on an order currently at `from`, including
// `from` itself so a form can render its current value.
function allowedTargets(table, from, role, context = {}) {
  const f = normalize(from);
  if (!isKnownStatus(f)) return [];
  return ORDER_STATUS_VALUES.filter(to => canTransition(table, f, to, role, context).allowed);
}

// Every status, each marked allowed or not with the reason. The form renders
// the blocked ones disabled with their reason rather than omitting them, so a
// missing Delivered option doesn't read as a bug when payment is outstanding.
function describeTargets(table, from, role, context = {}) {
  const f = normalize(from);
  if (!isKnownStatus(f)) return [];
  return ORDER_STATUS_VALUES.map(to => {
    const { allowed, error } = canTransition(table, f, to, role, context);
    return {
      value: to,
      label: ORDER_STATUS_LABELS[to],
      allowed,
      reason: allowed ? null : error.message,
    };
  });
}

module.exports = {
  ORDER_ENTITY,
  rowsToTable,
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  DEFAULT_TRANSITIONS,
  isKnownStatus,
  canTransition,
  assertTransition,
  allowedTargets,
  describeTargets,
};
