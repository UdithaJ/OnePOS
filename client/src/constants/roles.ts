// Mirrors main/constants/roles.js. The frontend is a separate bundle and cannot
// import from main/, so the two must be kept in step — if a role is added
// there, add it here.

export const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  SYSADMIN: 'sysadmin',
} as const

// Roles with full administrative rights. sysadmin is the built-in account
// seeded on first start; it is hidden from the user list but can do everything
// an admin can, so every check for "is an admin" has to accept it.
export const ADMIN_ROLES: string[] = [ROLES.ADMIN, ROLES.SYSADMIN]

export function isAdminRole(role?: string | null): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

// The built-in account only. System upgrades can rewrite any collection, so
// they are not something an ordinary admin should reach.
export const SYSADMIN_ROLES: string[] = [ROLES.SYSADMIN]

export function isSysadminRole(role?: string | null): boolean {
  return role === ROLES.SYSADMIN
}
