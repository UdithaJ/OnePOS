const Category = require('../models/category');
const OrderCategory = require('../models/orderCategory');

exports.createCategory = async (data) => {
  const category = new Category(data);
  return await category.save();
};

exports.updateCategory = async (id, data) => {
  return await Category.findByIdAndUpdate(id, data, { new: true });
};

exports.getAllCategories = async () => {
  // Return categories with `inUse` flag when referenced by any OrderCategory
  const categories = await Category.find().lean();
  return await Promise.all(categories.map(async (c) => {
    const count = await OrderCategory.countDocuments({ category: c._id });
    return { ...c, inUse: count > 0 };
  }));
};

exports.getCategoryById = async (id) => {
  return await Category.findById(id);
};

exports.deleteCategory = async (id) => {
  // Prevent deletion if this category is referenced by any order suborders
  const inUse = await OrderCategory.countDocuments({ category: id });
  if (inUse > 0) {
    throw new Error('This category is in use and cannot be deleted');
  }
  return await Category.findByIdAndDelete(id);
};
