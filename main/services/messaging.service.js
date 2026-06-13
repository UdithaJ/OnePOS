const Customer = require('../models/customer');

async function sendBulkSms({ message, customerIds }) {
  const customers = await Customer.find({ _id: { $in: customerIds } });
  const phones = customers.map(c => c.mobileNumber).filter(Boolean);

  // Stub: log SMS details. Replace with real provider (e.g. Twilio, AWS SNS).
  console.log(`[SMS] Sending to ${phones.length} recipient(s): "${message}"`);
  phones.forEach(phone => console.log(`  -> ${phone}`));

  return { sent: phones.length };
}

module.exports = { sendBulkSms };
