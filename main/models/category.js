const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  minimumPrice: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('Category', categorySchema);
