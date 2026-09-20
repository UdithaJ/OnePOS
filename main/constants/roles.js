// The roles a user can hold, in one place so the API, the seeds and the
// workflow rules agree on the spelling.

const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  // The built-in account seeded on first start so a new system can be signed
  // into. Not offered anywhere in the UI and not listed among the users — it
  // exists to get the first real administrator created.
  SYSADMIN: 'sysadmin',
};

// Roles that may be assigned through the application. SYSADMIN is deliberately
// absent: there is exactly one such account and it comes from the seed.
const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.CASHIER];

// Users holding these roles are hidden from the user list and cannot be
// changed or removed through the API.
const HIDDEN_ROLES = [ROLES.SYSADMIN];

// Roles with full administrative rights. Referenced by the workflow rules, so
// the built-in account can do everything an administrator can.
const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SYSADMIN];

module.exports = { ROLES, ASSIGNABLE_ROLES, HIDDEN_ROLES, ADMIN_ROLES };
