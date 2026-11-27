const axios = require('axios');

const NOTIFY_URL = 'https://app.notify.lk/api/v1/send';
const REQUEST_TIMEOUT_MS = 15000;

// Notify.lk's documented maximum message length.
const MAX_MESSAGE_LENGTH = 621;

// Errors that mean the request never reached Notify.lk, so trying again cannot
// produce a second SMS.
const NOT_DELIVERED_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);

// Gateway answers that mean the request was not processed.
const RETRYABLE_HTTP = new Set([429, 502, 503, 504]);

// A refusal that would repeat for every recipient (bad account, no credit,
// unapproved sender ID). Sending on would only turn the whole campaign into
// failures, so the campaign is paused instead.
const ACCOUNT_PROBLEM = /user[_ ]?id|api[_ ]?key|credential|unauthori[sz]ed|credit|balance|insufficient|sender/i;

function credentials() {
  return {
    user_id: process.env.NOTIFY_USER_ID,
    api_key: process.env.NOTIFY_API_KEY,
    sender_id: process.env.NOTIFY_SENDER_ID || 'NotifyDEMO',
  };
}

function isConfigured() {
  const { user_id, api_key } = credentials();
  return !!(user_id && api_key);
}

// Local Sri Lankan mobile numbers (0771234567, +94771234567, 94771234567,
// 771234567) in Notify.lk's 947XXXXXXXX form. Anything else is not an SMS-able
// mobile number and comes back null.
function toNotifyNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[\s\-()+]/g, '');
  const m = digits.match(/^(?:94|0)?(7\d{8})$/);
  return m ? `94${m[1]}` : null;
}

function errorText(errors) {
  if (!errors) return '';
  if (Array.isArray(errors)) return errors.join(' ');
  if (typeof errors === 'object') return Object.values(errors).flat().join(' ');
  return String(errors);
}

// Turns one Notify.lk exchange into what the caller should do next:
//   accepted - Notify.lk accepted it (not proof of delivery to the handset)
//   rejected - refused for this recipient; retrying won't help
//   retry    - not processed, safe to try again
//   unknown  - the request may have been processed; retrying risks a duplicate
//   halt     - an account-level refusal that will repeat for everyone
function classifyNotifyResult({ data, httpStatus, error }) {
  if (error && !httpStatus) {
    const code = error.code || '';
    const reason = `Could not reach Notify.lk (${code || error.message || 'network error'})`;
    return { outcome: NOT_DELIVERED_CODES.has(code) ? 'retry' : 'unknown', reason };
  }
  if (data && data.status === 'success') {
    return { outcome: 'accepted', reason: null };
  }
  if (RETRYABLE_HTTP.has(httpStatus)) {
    return { outcome: 'retry', reason: `Notify.lk is busy or unavailable (HTTP ${httpStatus})` };
  }
  const text = errorText(data && (data.errors || data.message || data.error));
  if (data && data.status === 'error' && text) {
    return { outcome: ACCOUNT_PROBLEM.test(text) ? 'halt' : 'rejected', reason: text };
  }
  return {
    outcome: 'unknown',
    reason: `Unexpected reply from Notify.lk${httpStatus ? ` (HTTP ${httpStatus})` : ''}`,
  };
}

// Sends one SMS (Notify.lk takes one recipient per request) and classifies the
// result. `to` must already be in 947XXXXXXXX form.
async function callNotify({ to, message }) {
  const { user_id, api_key, sender_id } = credentials();
  if (!user_id || !api_key) {
    return { outcome: 'halt', reason: 'Notify.lk credentials are not configured (NOTIFY_USER_ID / NOTIFY_API_KEY).' };
  }
  const body = new URLSearchParams({ user_id, api_key, sender_id, to, message });
  try {
    const resp = await axios.post(NOTIFY_URL, body, { timeout: REQUEST_TIMEOUT_MS });
    return { ...classifyNotifyResult({ data: resp.data, httpStatus: resp.status }), response: resp.data };
  } catch (err) {
    const httpStatus = err.response ? err.response.status : undefined;
    const data = err.response ? err.response.data : undefined;
    return { ...classifyNotifyResult({ data, httpStatus, error: err }), response: data };
  }
}

// Single transactional SMS (OTP, order ready). Every failure is logged with
// Notify.lk's reason so a missing SMS can be traced.
async function sendSms({ to, message }) {
  if (!isConfigured()) {
    console.warn('[SMS] Notify.lk credentials not set; logging instead of sending');
    console.log(`[SMS] (LOG) To: ${to} Message: ${message}`);
    return { sent: 0, logged: true };
  }
  const formattedTo = toNotifyNumber(to);
  if (!formattedTo) {
    console.error(`[SMS] Not sent to ${to}: not a valid Sri Lankan mobile number`);
    return { sent: 0, error: 'Invalid mobile number' };
  }
  const result = await callNotify({ to: formattedTo, message });
  if (result.outcome === 'accepted') {
    return { sent: 1, provider: 'notify.lk', response: result.response };
  }
  console.error(`[SMS] Not sent to ${formattedTo} (${result.outcome}): ${result.reason}`);
  return { sent: 0, provider: 'notify.lk', error: result.reason, response: result.response };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  sendSms,
  callNotify,
  classifyNotifyResult,
  toNotifyNumber,
  isConfigured,
  credentials,
};
