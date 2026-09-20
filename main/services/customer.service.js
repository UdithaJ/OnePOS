const Customer = require('../models/customer');

async function getAllCustomers() {
  return await Customer.find();
}

const CUSTOMER_SORTABLE = new Set(['firstName', 'lastName', 'mobileNumber', 'city', 'state']);

async function getCustomersPaginated({ page = 1, limit = 10, sort = 'firstName', order = 'asc' } = {}) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, parseInt(limit) || 10);
  const field = CUSTOMER_SORTABLE.has(sort) ? sort : 'firstName';
  const dir = order === 'desc' ? -1 : 1;
  const [items, total] = await Promise.all([
    Customer.find().sort({ [field]: dir }).skip((p - 1) * l).limit(l).lean(),
    Customer.countDocuments(),
  ]);
  return { items, total, page: p, limit: l };
}

async function getCustomerById(id) {
  return await Customer.findById(id);
}

// A mobile number identifies a customer, so it may only belong to one of them.
// Every path that writes a mobile number goes through this lookup first.
async function findByMobileNumber(mobileNumber) {
  if (!mobileNumber) return null;
  return await Customer.findOne({ mobileNumber: String(mobileNumber).trim() });
}

function duplicateMobileError(mobileNumber) {
  const err = new Error(`A customer is already registered with mobile number ${mobileNumber}.`);
  err.status = 409;
  return err;
}

// Throws a 409 when the mobile number is taken. `excludeId` lets an update keep
// its own number without colliding with itself.
async function assertMobileNumberAvailable(mobileNumber, excludeId = null) {
  const existing = await findByMobileNumber(mobileNumber);
  if (!existing) return;
  if (excludeId && String(existing._id) === String(excludeId)) return;
  throw duplicateMobileError(mobileNumber);
}

// Two concurrent requests can both clear assertMobileNumberAvailable before
// either saves. The unique index added by
// `node main/scripts/checkDuplicateCustomerMobiles.js --create-index` catches
// that; this turns its driver error into the same 409 the caller expects.
function asDuplicateMobileError(err, mobileNumber) {
  if (err?.code === 11000 && err?.keyPattern?.mobileNumber) {
    return duplicateMobileError(mobileNumber);
  }
  return err;
}

async function createCustomer(data) {
  const mobileNumber = data?.mobileNumber ? String(data.mobileNumber).trim() : data?.mobileNumber;
  await assertMobileNumberAvailable(mobileNumber);
  const customer = new Customer({ ...data, mobileNumber });
  try {
    return await customer.save();
  } catch (err) {
    throw asDuplicateMobileError(err, mobileNumber);
  }
}

async function updateCustomer(id, data) {
  if (data?.mobileNumber !== undefined) {
    const mobileNumber = String(data.mobileNumber).trim();
    await assertMobileNumberAvailable(mobileNumber, id);
    data = { ...data, mobileNumber };
  }
  try {
    return await Customer.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (err) {
    throw asDuplicateMobileError(err, data?.mobileNumber);
  }
}

async function deleteCustomer(id) {
  return await Customer.findByIdAndDelete(id);
}

module.exports = {
  getAllCustomers,
  getCustomersPaginated,
  getCustomerById,
  findByMobileNumber,
  assertMobileNumberAvailable,
  duplicateMobileError,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
