// Order money rules, shared by pricing and payments.
//
// Line item amounts are charged to the nearest 10 (1988.75 → 1990), so the due
// amount on screen is always a whole number the operator can type back in. The
// unrounded amount is kept alongside for reference.
//
// Mirrored in client/src/utils/money.ts — keep the two in step.

// Settle to cents first, so float noise such as 340.7499999… doesn't decide
// which way a boundary value rounds.
function toCents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundToTen(value) {
  return Math.round(toCents(value) / 10) * 10;
}

module.exports = { toCents, roundToTen };
