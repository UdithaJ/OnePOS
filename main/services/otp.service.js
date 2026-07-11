const messaging = require('./messaging.service');

// In-memory pending map: mobileNumber -> { otp, expiresAt, data }
const pending = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createPending(mobileNumber, customerData) {
  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  pending.set(mobileNumber, { otp, expiresAt, data: customerData });

  // Send SMS (stubbed)
  await messaging.sendSms({ to: mobileNumber, message: `Your verification code is ${otp} for Softwash Laundry customer verification` });

  return { otpSent: true };
}

function verifyOtp(mobileNumber, otp) {
  const entry = pending.get(mobileNumber);
  if (!entry) throw new Error('No pending OTP for this number');
  if (Date.now() > entry.expiresAt) {
    pending.delete(mobileNumber);
    throw new Error('OTP expired');
  }
  if (entry.otp !== String(otp)) throw new Error('Invalid OTP');

  const data = entry.data;
  pending.delete(mobileNumber);
  return data;
}

module.exports = { createPending, verifyOtp };
