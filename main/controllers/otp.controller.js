const otpService = require('../services/otp.service');
const customerService = require('../services/customer.service');

exports.sendOtp = async (req, res) => {
  try {
    const { mobileNumber, customer } = req.body;
    if (!mobileNumber) return res.status(400).json({ message: 'mobileNumber is required' });

    // Reject a number that already belongs to a customer before an SMS goes out,
    // so the user is told at the form rather than after entering an OTP.
    await customerService.assertMobileNumberAvailable(mobileNumber);

    await otpService.createPending(mobileNumber, customer || {});
    res.json({ message: 'OTP sent' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;
    if (!mobileNumber || !otp) return res.status(400).json({ message: 'mobileNumber and otp are required' });

    const customerData = otpService.verifyOtp(mobileNumber, otp);
    // create customer now
    const newCustomer = await customerService.createCustomer(customerData);
    res.json(newCustomer);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};
