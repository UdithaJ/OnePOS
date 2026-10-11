// The expense category that records cash taken from the drawer to the bank.
//
// Bank deposits are ordinary expenses in a category the shop creates itself,
// so the reports find them by name. The name is "Bank Deposit"; older installs
// created it as "Bank Deposite", which still matches so their history keeps
// reporting. Case and stray whitespace are ignored.
//
// expenses.json repeats this pattern as a string for its category filter;
// keep the two in step.
//
// Not a report processor: no definition names it, so the engine never loads it.

const BANK_DEPOSIT_PATTERN = '^\\s*bank\\s+deposite?\\s*$';
const BANK_DEPOSIT_REGEX = new RegExp(BANK_DEPOSIT_PATTERN, 'i');

module.exports = { BANK_DEPOSIT_PATTERN, BANK_DEPOSIT_REGEX };
