// Bulk SMS campaigns: the rules that decide what gets sent, what is retried,
// and what is left for a person to check.
//
// The send pipeline is only as safe as these decisions:
//   - which numbers are SMS-able, and duplicates collapse to one SMS,
//   - how a Notify.lk reply is classified (accepted / retry / unknown /
//     rejected / halt),
//   - what a recipient becomes after each outcome — in particular, nothing
//     that may already have been sent is ever retried automatically.
//
// Pure functions only; no database or network.
//
// Run: node main/__tests__/sms-campaign.test.js

const assert = require('assert');
const messaging = require('../services/messaging.service');
const smsWorker = require('../services/smsWorker');
const campaigns = require('../services/smsCampaign.service');

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

(async () => {
  console.log('sms numbers');

  await test('local, +94, 94 and bare 7XXXXXXXX forms all become 947XXXXXXXX', () => {
    for (const n of ['0771234567', '+94771234567', '94771234567', '771234567', '077 123 4567', '077-123-4567']) {
      assert.strictEqual(messaging.toNotifyNumber(n), '94771234567', n);
    }
  });

  await test('landlines, short numbers and blanks are not SMS-able', () => {
    for (const n of ['0112345678', '077123456', '07712345678', '', null, 'abc']) {
      assert.strictEqual(messaging.toNotifyNumber(n), null, String(n));
    }
  });

  console.log('notify.lk replies');

  await test('status success is accepted', () => {
    assert.strictEqual(messaging.classifyNotifyResult({ data: { status: 'success' }, httpStatus: 200 }).outcome, 'accepted');
  });

  await test('an invalid account halts the campaign (real Notify.lk reply)', () => {
    const r = messaging.classifyNotifyResult({ data: { status: 'error', errors: 'user_id is invalid' }, httpStatus: 400 });
    assert.strictEqual(r.outcome, 'halt');
    assert.match(r.reason, /user_id is invalid/);
  });

  await test('no credit or an unapproved sender ID halts the campaign', () => {
    for (const msg of ['Insufficient credit balance', 'Sender ID is not approved']) {
      assert.strictEqual(messaging.classifyNotifyResult({ data: { status: 'error', errors: [msg] }, httpStatus: 400 }).outcome, 'halt', msg);
    }
  });

  await test('a refusal about this recipient fails just that recipient', () => {
    const r = messaging.classifyNotifyResult({ data: { status: 'error', errors: ['The to field format is invalid.'] }, httpStatus: 400 });
    assert.strictEqual(r.outcome, 'rejected');
  });

  await test('a request that never reached Notify.lk is retried', () => {
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']) {
      assert.strictEqual(messaging.classifyNotifyResult({ error: { code } }).outcome, 'retry', code);
    }
    for (const httpStatus of [429, 502, 503, 504]) {
      assert.strictEqual(messaging.classifyNotifyResult({ data: '', httpStatus, error: {} }).outcome, 'retry', String(httpStatus));
    }
  });

  await test('a timeout or dropped connection is unknown, not retried — it may have been sent', () => {
    for (const code of ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET']) {
      assert.strictEqual(messaging.classifyNotifyResult({ error: { code } }).outcome, 'unknown', code);
    }
  });

  await test('an HTTP 500 or unreadable reply is unknown', () => {
    assert.strictEqual(messaging.classifyNotifyResult({ data: '<html>', httpStatus: 500, error: {} }).outcome, 'unknown');
    assert.strictEqual(messaging.classifyNotifyResult({ data: 'ok', httpStatus: 200 }).outcome, 'unknown');
  });

  console.log('recipient list');

  const customer = (id, mobileNumber, extra = {}) => ({ _id: id, firstName: `F${id}`, lastName: `L${id}`, mobileNumber, ...extra });

  await test('each valid customer becomes a pending recipient with the 94 number', () => {
    const [r] = campaigns.buildRecipients([customer(1, '0771234567')], 'Hello');
    assert.strictEqual(r.status, 'pending');
    assert.strictEqual(r.to, '94771234567');
    assert.strictEqual(r.name, 'F1 L1');
  });

  await test('a second customer with the same number is skipped, so nobody gets it twice', () => {
    const rows = campaigns.buildRecipients([customer(1, '0771234567'), customer(2, '0771234567')], 'Hi');
    assert.deepStrictEqual(rows.map(r => r.status), ['pending', 'skipped']);
    assert.match(rows[1].reason, /Duplicate number.*F1 L1/);
  });

  await test('an invalid number is skipped with a reason', () => {
    const [r] = campaigns.buildRecipients([customer(1, '0112345678')], 'Hi');
    assert.strictEqual(r.status, 'skipped');
    assert.match(r.reason, /valid Sri Lankan mobile/);
  });

  await test('{name} becomes the title and first name, or "Customer"', () => {
    const rows = campaigns.buildRecipients([
      customer(1, '0771111111', { title: 'Mr', firstName: 'Nimal' }),
      { _id: 2, mobileNumber: '0772222222' },
    ], 'Dear {name}, Happy New Year');
    assert.strictEqual(rows[0].message, 'Dear Mr Nimal, Happy New Year');
    assert.strictEqual(rows[1].message, 'Dear Customer, Happy New Year');
  });

  await test('a message pushed past 621 characters by a long name is skipped', () => {
    const template = `${'x'.repeat(615)} {name}`;
    const rows = campaigns.buildRecipients([
      customer(1, '0771111111', { title: '', firstName: 'Al' }),
      customer(2, '0772222222', { title: 'Mr', firstName: 'Bartholomew' }),
    ], template);
    assert.deepStrictEqual(rows.map(r => r.status), ['pending', 'skipped']);
  });

  console.log('after each send');

  const now = new Date('2026-12-31T09:00:00Z');
  const job = attempts => ({ attempts });

  await test('accepted is recorded with the time', () => {
    const { set } = smsWorker.decideUpdate(job(1), { outcome: 'accepted' }, now);
    assert.strictEqual(set.status, 'accepted');
    assert.strictEqual(set.acceptedAt, now);
  });

  await test('a retryable failure waits and retries, backing off', () => {
    const first = smsWorker.decideUpdate(job(1), { outcome: 'retry', reason: 'busy' }, now).set;
    const second = smsWorker.decideUpdate(job(2), { outcome: 'retry', reason: 'busy' }, now).set;
    assert.strictEqual(first.status, 'retrying');
    assert.ok(second.nextAttemptAt - now > first.nextAttemptAt - now);
  });

  await test('after the last attempt a retryable failure becomes failed', () => {
    const { set } = smsWorker.decideUpdate(job(smsWorker.CONFIG.maxAttempts), { outcome: 'retry', reason: 'busy' }, now);
    assert.strictEqual(set.status, 'failed');
    assert.match(set.reason, /gave up after/);
  });

  await test('unknown is never queued again automatically', () => {
    const { set } = smsWorker.decideUpdate(job(1), { outcome: 'unknown', reason: 'Timeout' }, now);
    assert.strictEqual(set.status, 'unknown');
    assert.strictEqual(set.nextAttemptAt, null);
    assert.match(set.reason, /Notify\.lk dashboard/);
  });

  await test('a halt puts the recipient back unchanged and pauses the campaign', () => {
    const { set, haltReason } = smsWorker.decideUpdate(job(1), { outcome: 'halt', reason: 'user_id is invalid' }, now);
    assert.strictEqual(set.status, 'pending');
    assert.strictEqual(set.attempts, 0, 'the attempt that hit the account problem does not count');
    assert.strictEqual(haltReason, 'user_id is invalid');
  });

  await test('a rejection fails the recipient with Notify.lk\'s reason', () => {
    const { set } = smsWorker.decideUpdate(job(1), { outcome: 'rejected', reason: 'Invalid number' }, now);
    assert.strictEqual(set.status, 'failed');
    assert.strictEqual(set.reason, 'Invalid number');
  });

  if (failures) {
    console.error(`\n${failures} failing`);
    process.exit(1);
  }
  console.log('\nall passed');
  process.exit(0);
})();
