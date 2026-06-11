const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  dailyCapacityKg: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  dueSoonLeadDays: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  }
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
