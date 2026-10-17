const { parseCsv } = require('../utils/csv');
const { ROLES } = require('../constants/roles');
const Customer = require('../models/customer');

// models/user.js is an ES module, so the namespace arrives under .default.
const UserModule = require('../models/user');
const User = UserModule.default || UserModule;

// Bulk creation of customers from a CSV file. Every row is checked before
// anything is written, and the file is imported whole or not at all: a file
// with one bad row is sent back to be fixed rather than half-loaded.

const MAX_ROWS = 5000;

const TITLES = ['Mr', 'Ms'];

// Header cells are matched ignoring case, spaces and punctuation, so "First
// Name", "first_name" and "firstName" all name the same column. Required
// columns match the customer form on the Customers screen.
const COLUMNS = [
  { key: 'title', label: 'Title', aliases: ['title'], required: true },
  { key: 'firstName', label: 'First Name', aliases: ['firstname'], required: true },
  { key: 'lastName', label: 'Last Name', aliases: ['lastname'] },
  { key: 'mobileNumber', label: 'Mobile Number', aliases: ['mobilenumber', 'mobile', 'phone'], required: true },
  { key: 'addressLine1', label: 'Address Line 1', aliases: ['addressline1', 'address1', 'address'] },
  { key: 'addressLine2', label: 'Address Line 2', aliases: ['addressline2', 'address2'] },
  { key: 'city', label: 'City', aliases: ['city'] },
  { key: 'state', label: 'State', aliases: ['state'] },
  { key: 'postalCode', label: 'Postal Code', aliases: ['postalcode', 'postcode', 'zip', 'zipcode'] },
];

function failure(message, status = 422) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeHeader(cell) {
  return String(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Same rule as the System Upgrades screen: the role is read from the database,
// not taken from the request. There is no session or token in this
// application, so this stops the UI and a signed-in user, not a request crafted
// with a sysadmin id.
async function assertMayImport(actingUserId) {
  if (!actingUserId) throw failure('Sign in as the system administrator to import customers.', 403);
  const user = await User.findById(actingUserId).catch(() => null);
  if (!user) throw failure('Sign in as the system administrator to import customers.', 403);
  if (user.userRole !== ROLES.SYSADMIN) {
    throw failure('Only the system administrator can import customers.', 403);
  }
  return user;
}

function checkTitle(row) {
  if (!row.title) return;
  // "mr", "MR" and "Mr." are all the same title.
  const match = TITLES.find(t => t.toLowerCase() === row.title.replace(/\.$/, '').toLowerCase());
  if (match) row.title = match;
  else row.errors.push(`Title "${row.title}" is not valid. Use ${TITLES.join(' or ')}.`);
}

function checkMobile(row, taken, seenInFile) {
  if (!row.mobileNumber) return;
  // Spaces and dashes are how people write numbers, not part of them.
  const digits = row.mobileNumber.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(digits)) {
    // A spreadsheet that stored the column as a number drops the leading 0.
    const hint = /^\d{9}$/.test(digits)
      ? ' It has 9 — the leading 0 may have been lost when the file was saved; format the column as text.'
      : '';
    row.errors.push(`Mobile number "${row.mobileNumber}" must be exactly 10 digits.${hint}`);
    return;
  }
  row.mobileNumber = digits;
  if (taken.has(digits)) {
    row.errors.push(`A customer is already registered with mobile number ${digits}.`);
  }
  if (seenInFile.has(digits)) {
    row.errors.push(`Mobile number ${digits} is also on line ${seenInFile.get(digits)}.`);
  } else {
    seenInFile.set(digits, row.line);
  }
}

// Pure: checks the file against the mobile numbers already registered and
// reports every problem at once, so one round of fixes is enough.
function validateCustomerCsv(text, existingMobileNumbers = []) {
  if (!String(text ?? '').trim()) throw failure('The file is empty.');

  const [header, ...body] = parseCsv(text);

  const positions = {};
  header.forEach((cell, index) => {
    const name = normalizeHeader(cell);
    const column = COLUMNS.find(c => c.aliases.includes(name));
    if (column && positions[column.key] === undefined) positions[column.key] = index;
  });

  const missing = COLUMNS.filter(c => c.required && positions[c.key] === undefined).map(c => c.label);
  if (missing.length) {
    throw failure(
      `The first line must name the columns. Missing: ${missing.join(', ')}. ` +
      `Columns: ${COLUMNS.map(c => c.label).join(', ')}.`,
    );
  }

  // Blank lines — often left at the end by spreadsheets — are not rows.
  const lines = body
    .map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells }) => cells.some(cell => cell.trim() !== ''));

  if (!lines.length) throw failure('The file has a header line but no customers.');
  if (lines.length > MAX_ROWS) {
    throw failure(`The file has ${lines.length} customers. Import at most ${MAX_ROWS} at a time.`);
  }

  const taken = new Set(existingMobileNumbers.map(String));
  const seenInFile = new Map();

  const rows = lines.map(({ cells, line }) => {
    const row = { line, errors: [] };
    for (const column of COLUMNS) {
      const position = positions[column.key];
      row[column.key] = position === undefined ? '' : (cells[position] ?? '').trim();
      if (column.required && !row[column.key]) row.errors.push(`${column.label} is required.`);
    }
    checkTitle(row);
    checkMobile(row, taken, seenInFile);
    return row;
  });

  const invalid = rows.filter(r => r.errors.length).length;
  return { rows, total: rows.length, invalid, valid: invalid === 0 };
}

async function existingMobileNumbers() {
  const customers = await Customer.find({}, { mobileNumber: 1 }).lean();
  return customers.map(c => c.mobileNumber);
}

async function previewImport({ csv, actingUserId }) {
  await assertMayImport(actingUserId);
  return validateCustomerCsv(csv, await existingMobileNumbers());
}

// Validated again here rather than trusting the preview: customers may have
// been added since, and the request may not have come from the screen at all.
async function applyImport({ csv, actingUserId }) {
  await assertMayImport(actingUserId);
  const result = validateCustomerCsv(csv, await existingMobileNumbers());
  if (!result.valid) {
    const err = failure(`${result.invalid} row(s) have problems. Nothing was imported.`);
    err.details = result;
    throw err;
  }

  // Ids are assigned up front so a failed insert can be undone: MongoDB here
  // is a standalone server with no transactions. Empty optional cells are left
  // off rather than stored as empty strings, as the Customers form does.
  const docs = result.rows.map(row => {
    const doc = {};
    for (const column of COLUMNS) {
      if (row[column.key]) doc[column.key] = row[column.key];
    }
    return new Customer(doc);
  });

  try {
    await Customer.insertMany(docs);
  } catch (err) {
    await Customer.deleteMany({ _id: { $in: docs.map(d => d._id) } });
    const reason = err?.code === 11000
      ? 'one of the mobile numbers was registered by someone else while importing'
      : err.message;
    throw failure(`The import stopped and was undone: ${reason}.`, err?.code === 11000 ? 409 : 500);
  }

  return { imported: docs.length };
}

module.exports = {
  validateCustomerCsv,
  previewImport,
  applyImport,
  COLUMNS,
  MAX_ROWS,
};
