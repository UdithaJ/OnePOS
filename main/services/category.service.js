const Category = require('../models/category');

exports.createCategory = async (data) => {
  const category = new Category(data);
  return await category.save();
};

exports.updateCategory = async (id, data) => {
  return await Category.findByIdAndUpdate(id, data, { new: true });
};

exports.getAllCategories = async () => {
  return await Category.find();
};

exports.getCategoryById = async (id) => {
  return await Category.findById(id);
};
