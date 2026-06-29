// models/customer.js

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  },
  mobileNumber: {
    type: String,
    required: true
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