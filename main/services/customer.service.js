const Customer = require('../models/customer');

async function getAllCustomers() {
  return await Customer.find();
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
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
