// Which order status may follow which, and who is allowed to make the move.
//
// These rules used to be split between order.service.js (item edits blocked on
// done/delivered) and OrderList.vue (`isOrderFullyLocked`, the hardcoded status
// list), which meant the two could disagree — and did: the UI treated Delivered
// as terminal while the API happily moved a delivered order back to To Do.
// The table below is the single statement of the rules; the service enforces
// it and the form asks the server what to offer rather than deciding for itself.
//
// Reading the table: TRANSITIONS[from][to] exists when the move is permitted at
// all. `roles` (when present) names who may perform it; `guard` (when present)
// is a condition on the order itself, checked against the state the order will
// be in once the update is applied — not the state it is in now. Staying on the
// same status is always allowed — the order form resends `status` on every
// save, so an unchanged value must never be treated as a transition.

const ORDER_STATUS_VALUES = ['todo', 'done', 'cancelled', 'delivered'];

const ORDER_STATUS_LABELS = {
  todo: 'To Do',
  done: 'Done',
  cancelled: 'Cancelled',
  delivered: 'Delivered',
};

// Goods are only handed over once the money is in, so Delivered is gated on the
// payment status the order will carry after this update — a payment or discount
// applied in the same save counts.
const requirePaid = {
  check: (context) => context.paymentStatus === 'paid',
  message: 'An order can only be marked Delivered once its payment status is Paid.',
};

const TRANSITIONS = {
  todo: {
    done: {},
    delivered: { guard: requirePaid },
    cancelled: { roles: ['admin'] },
  },
  done: {
    todo: {},
    delivered: { guard: requirePaid },
    cancelled: { roles: ['admin'] },
  },
  cancelled: {
    // Reopening a cancelled order is itself an admin action.
    todo: { roles: ['admin'] },
  },
  // Delivered is terminal: the goods have left the shop.
  delivered: {},
};

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

// Returns { allowed, error } rather than throwing, so callers that are building
// a list of options (allowedTargets) don't pay for exceptions. `context` carries
// the order state the guards read, e.g. { paymentStatus }.
function canTransition(from, to, role, context = {}) {
  const f = normalize(from);
  const t = normalize(to);

  if (!isKnownStatus(f)) return { allowed: false, error: transitionError(`Unknown order status "${from}".`, 422) };
  if (!isKnownStatus(t)) return { allowed: false, error: transitionError(`Unknown order status "${to}".`, 422) };

  // A status that is not changing is not a transition.
  if (f === t) return { allowed: true };

  const rule = TRANSITIONS[f][t];
  if (!rule) {
    return {
      allowed: false,
      error: transitionError(`An order cannot move from ${label(f)} to ${label(t)}.`, 422),
    };
  }

  if (rule.roles && !rule.roles.includes(role)) {
    const who = rule.roles.map(r => `${r} users`).join(' or ');
    return {
      allowed: false,
      // 403: the move is legal, this user may not make it.
      error: transitionError(`Only ${who} can change an order to ${label(t)}.`, 403),
    };
  }

  if (rule.guard && !rule.guard.check(context)) {
    // 422: anyone may make this move, but the order isn't in a fit state yet.
    return { allowed: false, error: transitionError(rule.guard.message, 422) };
  }

  return { allowed: true };
}

function assertTransition(from, to, role, context = {}) {
  const { allowed, error } = canTransition(from, to, role, context);
  if (!allowed) throw error;
}

// Every status this role may set on an order currently at `from`, including
// `from` itself so a form can render its current value.
function allowedTargets(from, role, context = {}) {
  const f = normalize(from);
  if (!isKnownStatus(f)) return [];
  return ORDER_STATUS_VALUES.filter(to => canTransition(f, to, role, context).allowed);
}

// Every status, each marked allowed or not with the reason. The form renders
// the blocked ones disabled with their reason rather than omitting them, so a
// missing Delivered option doesn't read as a bug when payment is outstanding.
function describeTargets(from, role, context = {}) {
  const f = normalize(from);
  if (!isKnownStatus(f)) return [];
  return ORDER_STATUS_VALUES.map(to => {
    const { allowed, error } = canTransition(f, to, role, context);
    return {
      value: to,
      label: ORDER_STATUS_LABELS[to],
      allowed,
      reason: allowed ? null : error.message,
    };
  });
}

module.exports = {
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  TRANSITIONS,
  isKnownStatus,
  canTransition,
  assertTransition,
  allowedTargets,
  describeTargets,
};
