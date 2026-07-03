const Customer = require('../models/customer');
const axios = require('axios');

const NOTIFY_URL = 'https://app.notify.lk/api/v1/send';

function formatNumberForNotify(phone) {
  // Expect local Sri Lankan mobile like 071xxxxxxx or +9471xxxxxxx or 9471xxxxxxx
  if (!phone) return phone;
  let p = phone.trim();
  if (p.startsWith('+')) p = p.slice(1);
  // If starts with 0, replace leading 0 with 94
  if (p.startsWith('0')) p = '94' + p.slice(1);
  return p;
}

async function sendSms({ to, message }) {
  const user_id = process.env.NOTIFY_USER_ID;
  const api_key = process.env.NOTIFY_API_KEY;
  const sender_id = process.env.NOTIFY_SENDER_ID || 'NotifyDEMO';

  if (!user_id || !api_key) {
    // Fallback to log when credentials are missing
    console.warn('[SMS] Notify.lk credentials not set; logging instead of sending');
    console.log(`[SMS] (LOG) To: ${to} Message: ${message}`);
    return { sent: 0, logged: true };
  }

  const formattedTo = formatNumberForNotify(to);

  try {
    const params = {
      user_id,
      api_key,
      sender_id,
      to: formattedTo,
      message,
    };

    const resp = await axios.get(NOTIFY_URL, { params, timeout: 10000 });

    if (resp && resp.data && resp.data.status === 'success') {
      return { sent: 1, provider: 'notify.lk', response: resp.data };
    }

    return { sent: 0, provider: 'notify.lk', response: resp.data };
  } catch (err) {
    console.error('[SMS] Error sending via Notify.lk', err.message || err);
    return { sent: 0, error: err.message || err };
  }
}

async function sendBulkSms({ message, customerIds }) {
  const customers = await Customer.find({ _id: { $in: customerIds } });
  const phones = customers.map(c => c.mobileNumber).filter(Boolean);

  console.log(`[SMS] Sending to ${phones.length} recipient(s): "${message}"`);

  // Send in parallel but limited to reasonable concurrency could be added later
  const results = await Promise.all(
    phones.map(phone => sendSms({ to: phone, message }))
  );

  const sent = results.reduce((acc, r) => acc + (r && r.sent ? 1 : 0), 0);

  return { requested: phones.length, sent, results };
}

module.exports = { sendBulkSms, sendSms };
