const Category = require('../models/category');

async function getAllCategories() {
  return await Category.find().sort({ name: 1 });
}

async function getCategoryById(id) {
  return await Category.findById(id);
}

async function createCategory(data) {
  const category = new Category(data);
  return await category.save();
}

async function updateCategory(id, data) {
  return await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteCategory(id) {
  return await Category.findByIdAndDelete(id);
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
