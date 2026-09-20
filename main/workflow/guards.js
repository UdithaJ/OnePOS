// Conditions a transition can require of the order itself, addressed by name so
// a stored rule can reference one. A guard is code, not data: the collection
// records *which* guard applies, never how it is evaluated.
//
// Adding a guard means adding it here and naming it in the transition rows.
// A row naming a guard that is not in this registry blocks the transition —
// see unknownGuard() in orderWorkflow.js. Failing open there would silently
// drop the rule the row was created to enforce.

const GUARDS = {
  // Goods are only handed over once the money is in. Checked against the
  // payment status the order will carry after the update is applied, so a
  // payment or discount in the same save counts.
  requirePaid: {
    describe: 'payment status is Paid',
    check: (context) => context.paymentStatus === 'paid',
    message: 'An order can only be marked Delivered once its payment status is Paid.',
  },
};

const GUARD_NAMES = Object.keys(GUARDS);

module.exports = { GUARDS, GUARD_NAMES };
