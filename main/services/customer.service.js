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

async function createCustomer(data) {
  const customer = new Customer(data);
  return await customer.save();
}

async function updateCustomer(id, data) {
  return await Customer.findByIdAndUpdate(id, data, { new: true });
}

async function deleteCustomer(id) {
  return await Customer.findByIdAndDelete(id);
}

module.exports = {
  getAllCustomers,
  getCustomersPaginated,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
