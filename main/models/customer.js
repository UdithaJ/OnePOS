// models/customer.js

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  title: {
    type: String,
    enum: ['Mr', 'Mrs', 'Miss', 'Dr']
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  },
  mobileNumber: {
    type: String,
    required: true,
    match: [/^\d{10}$/, 'Mobile number must be exactly 10 digits']
  },
  addressLine1: {
    type: String
  },
  addressLine2: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  postalCode: {
    type: String
  }
});

module.exports = mongoose.model('Customer', customerSchema);