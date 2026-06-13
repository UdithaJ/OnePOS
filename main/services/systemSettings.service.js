const SystemSettings = require('../models/systemSettings');

exports.getSettings = async () => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({ dailyCapacityKg: 0 });
  }
  return settings;
};

exports.updateSettings = async (data) => {
  const settings = await exports.getSettings();
  if (data.dailyCapacityKg !== undefined) {
    settings.dailyCapacityKg = data.dailyCapacityKg;
  }
  if (data.dueSoonLeadDays !== undefined) {
    settings.dueSoonLeadDays = data.dueSoonLeadDays;
  }
  await settings.save();
  return settings;
};
