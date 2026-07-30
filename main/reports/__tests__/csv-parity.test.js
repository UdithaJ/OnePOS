// End-to-end CSV parity: engine envelope -> the REAL client export code -> CSV,
// compared against the old per-report use*Export.ts output.
//
// This is the acceptance gate from §11 of REPORT_ENGINE_ARCHITECTURE.md. It
// compiles client/src/utils/reportFormat.ts and reportRows.ts with the project's
// own tsc and drives them directly, so it exercises the shipped formatting code
// rather than a copy of it.
//
// Run: node main/reports/__tests__/csv-parity.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const { groupRows } = require('../engine/grouper.js');
const { buildEnvelope } = require('../engine/envelope.js');

const TZ = 'Asia/Colombo';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n${indent(err.message)}`);
  }
}
function indent(text) {
  return String(text).split('\n').map((l) => `       ${l}`).join('\n');
}

// --- compile the client formatter so we can drive the real code -------------

function compileClientUtils() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-parity-'));
  const configPath = path.join(outDir, 'tsconfig.json');
  fs.writeFileSync(configPath, JSON.stringify({
    compilerOptions: {
      outDir,
      module: 'commonjs',
      target: 'es2020',
      skipLibCheck: true,
      baseUrl: path.join(ROOT, 'client'),
      paths: { '@/*': ['src/*'] },
    },
    files: [
      path.join(ROOT, 'client', 'src', 'utils', 'reportFormat.ts'),
      path.join(ROOT, 'client', 'src', 'utils', 'reportRows.ts'),
    ],
  }));

  execFileSync(
    path.join(ROOT, 'client', 'node_modules', '.bin', 'tsc'),
    ['-p', configPath],
    { stdio: 'pipe' },
  );

  // tsc mirrors the source tree under outDir, and leaves the '@/utils/...'
  // alias in the emitted require() calls; rewrite it to a relative path so the
  // CommonJS run can resolve it.
  const utilsDir = path.join(outDir, 'utils');
  for (const file of fs.readdirSync(utilsDir)) {
    const full = path.join(utilsDir, file);
    fs.writeFileSync(full, fs.readFileSync(full, 'utf8').replace(/@\/utils\//g, './'));
  }

  return {
    format: require(path.join(utilsDir, 'reportFormat.js')),
    rows: require(path.join(utilsDir, 'reportRows.js')),
  };
}

let client;
try {
  client = compileClientUtils();
} catch (err) {
  console.error('Could not compile client utils for parity test:\n' + indent(err.stdout || err.message));
  process.exit(1);
}

// --- fixture ----------------------------------------------------------------

function row(createdDate, orderId, orderNo, categoryName, weight, amount, totalAmount, discount) {
  return {
    createdDate,
    deliveryDate: createdDate,
    orderId,
    orderNo,
    status: 'done',
    rackNumber: 'R1',
    customerName: `Customer ${orderNo}`,
    mobileNumber: '0771234567',
    categoryName,
    weight,
    amount,
    totalAmount,
    discount,
    netAmount: totalAmount - discount,
  };
}

const rawRows = [
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Wash', 5, 500, 3000, 200),
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Dry', 3, 300, 3000, 200),
  row('2026-03-01T04:00:00.000Z', 'o1', 1, 'Iron', 2, 200, 3000, 200),
  row('2026-03-01T06:00:00.000Z', 'o2', 2, 'Wash', 4, 400, 400, 0),
  row('2026-03-02T05:00:00.000Z', 'o3', 3, 'Wash', 6, 600, 1000, 50),
  row('2026-03-02T05:00:00.000Z', 'o3', 3, 'Dry', 4, 400, 1000, 50),
];

function envelopeFor(definition) {
  const { rows, spansByRow } = groupRows(rawRows.map((r) => ({ ...r })), definition, TZ);
  return buildEnvelope({
    definition,
    rows,
    spansByRow,
    params: {},
    timezone: TZ,
    generatedAt: '2026-03-03T00:00:00.000Z',
  });
}

function newCSV(definition) {
  return client.rows.toCSV(client.rows.exportMatrix(envelopeFor(definition), false));
}

// --- legacy exporters, copied verbatim --------------------------------------

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toLocalDateKey(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

const STATUS_DISPLAY = { todo: 'To Do', done: 'Done', delivered: 'Delivered', cancelled: 'Cancelled' };

// from useDailySalesExport.ts
const DAILY_HEADERS = ['Date', 'Order No', 'Customer', 'Delivery Date', 'Status', 'Rack No', 'Laundry Category', 'Weight (kg)', 'Amount', 'Discount', 'Net Amount', 'Total Amount'];

function legacyDailyFlatRows(rows) {
  const dateTotals = new Map();
  const seenOrdersForDate = new Map();
  for (const r of rows) {
    const dateKey = toLocalDateKey(r.createdDate);
    const orderId = String(r.orderId);
    if (!seenOrdersForDate.has(dateKey)) seenOrdersForDate.set(dateKey, new Set());
    if (!seenOrdersForDate.get(dateKey).has(orderId)) {
      seenOrdersForDate.get(dateKey).add(orderId);
      dateTotals.set(dateKey, (dateTotals.get(dateKey) ?? 0) + (r.totalAmount - r.discount));
    }
  }

  const seenOrders = new Set();
  const seenDates = new Set();

  return rows.map((r) => {
    const dateKey = toLocalDateKey(r.createdDate);
    const orderId = String(r.orderId);
    const isFirstOrder = !seenOrders.has(orderId);
    const isFirstDate = !seenDates.has(dateKey);
    seenOrders.add(orderId);
    seenDates.add(dateKey);
    const netAmount = r.totalAmount - r.discount;

    return [
      isFirstOrder ? formatDate(r.createdDate) : '',
      isFirstOrder ? String(r.orderNo).padStart(4, '0') : '',
      isFirstOrder ? r.customerName : '',
      isFirstOrder ? formatDate(r.deliveryDate) : '',
      isFirstOrder ? (STATUS_DISPLAY[r.status] ?? r.status) : '',
      isFirstOrder ? (r.rackNumber ?? '-') : '',
      r.categoryName,
      String(r.weight),
      r.amount.toFixed(2),
      isFirstOrder ? (r.discount > 0 ? r.discount.toFixed(2) : '-') : '',
      isFirstOrder ? netAmount.toFixed(2) : '',
      isFirstDate ? (dateTotals.get(dateKey) ?? 0).toFixed(2) : '',
    ];
  });
}

function legacyDailyGrandTotal(rows) {
  const seen = new Set();
  let total = 0;
  for (const r of rows) {
    const id = String(r.orderId);
    if (!seen.has(id)) {
      seen.add(id);
      total += r.totalAmount - r.discount;
    }
  }
  return total;
}

function escapeCell(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function legacyDailyCSV(rows) {
  const all = [
    DAILY_HEADERS,
    ...legacyDailyFlatRows(rows),
    ['', '', '', '', '', '', '', '', '', '', 'Total for the given period', legacyDailyGrandTotal(rows).toFixed(2)],
  ];
  return all.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

// --- assertions -------------------------------------------------------------

console.log('\nDaily Sales — CSV parity (the §11 acceptance gate)');

const dailyDef = require('../definitions/daily-sales.json');
const produced = newCSV(dailyDef);
const legacy = legacyDailyCSV(rawRows);

test('CSV is byte-identical to the old useDailySalesExport output', () => {
  if (produced !== legacy) {
    const a = produced.split('\r\n');
    const b = legacy.split('\r\n');
    const diffs = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) diffs.push(`line ${i + 1}\n  new: ${a[i]}\n  old: ${b[i]}`);
    }
    assert.fail(diffs.join('\n'));
  }
});

console.log('\nPending Orders — documented deviation');

const pendingDef = require('../definitions/pending-orders.json');
const pendingCSV = newCSV(pendingDef);

test('Due Date is suppressed per date group, matching the table', () => {
  // The old CSV re-printed the due date for every order inside a date, while
  // the old table merged it across the whole date. The engine cannot reproduce
  // both; the table's behaviour wins. See MIGRATION-NOTES.md.
  const lines = pendingCSV.split('\r\n').slice(1, -1);
  const dateCells = lines.map((line) => line.split(',')[0]);
  assert.deepStrictEqual(dateCells, ['01/03/2026', '', '', '', '02/03/2026', '']);
});

test('Total Pending Weight has no unit suffix in CSV (table shows " kg")', () => {
  const footer = pendingCSV.split('\r\n').pop();
  assert.ok(footer.endsWith(',24'), `footer was: ${footer}`);
});

console.log('\nCash Box Summary — legacy display/export split preserved');

const cashBoxDef = require('../definitions/cash-box-summary.json');
const cashRows = [
  { orderNo: 1, createdDate: '2026-03-01T04:00:00.000Z', businessDate: null, customerName: 'A',
    totalAmount: 1500.5, discount: 0, orderAmountAfterDiscount: 1500.5, dueAmount: 0,
    paymentMethod: 'cash', paymentReceived: 1500.5 },
];

test('CSV uses toFixed(2) while the table uses toLocaleString()', () => {
  const { rows, spansByRow } = groupRows(cashRows.map((r) => ({ ...r })), cashBoxDef, TZ);
  const envelope = buildEnvelope({
    definition: cashBoxDef, rows, spansByRow, params: {}, timezone: TZ,
    generatedAt: '2026-03-03T00:00:00.000Z',
  });
  const totalColumn = envelope.columns.find((c) => c.key === 'totalAmount');

  assert.strictEqual(client.format.formatCell(1500.5, totalColumn, 'export'), '1500.50');
  assert.strictEqual(client.format.formatCell(1500.5, totalColumn, 'display'), (1500.5).toLocaleString());
});

test('a zero discount still exports as "-"', () => {
  const { rows, spansByRow } = groupRows(cashRows.map((r) => ({ ...r })), cashBoxDef, TZ);
  const envelope = buildEnvelope({
    definition: cashBoxDef, rows, spansByRow, params: {}, timezone: TZ,
    generatedAt: '2026-03-03T00:00:00.000Z',
  });
  const matrix = client.rows.exportMatrix(envelope, false);
  assert.strictEqual(matrix[1][5], '-');
});

test('Excel receives a real number where CSV receives text', () => {
  const { rows, spansByRow } = groupRows(cashRows.map((r) => ({ ...r })), cashBoxDef, TZ);
  const envelope = buildEnvelope({
    definition: cashBoxDef, rows, spansByRow, params: {}, timezone: TZ,
    generatedAt: '2026-03-03T00:00:00.000Z',
  });
  assert.strictEqual(client.rows.exportMatrix(envelope, true)[1][4], 1500.5);
  assert.strictEqual(client.rows.exportMatrix(envelope, false)[1][4], '1500.50');
});

console.log(failures === 0 ? '\nAll CSV parity checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
