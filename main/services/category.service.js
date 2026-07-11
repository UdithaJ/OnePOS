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

const CATEGORY_SORTABLE = new Set(['name', 'minimumPrice', 'unitPrice']);

exports.getCategoriesPaginated = async ({ page = 1, limit = 10, sort = 'name', order = 'asc' } = {}) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, parseInt(limit) || 10);
  const field = CATEGORY_SORTABLE.has(sort) ? sort : 'name';
  const dir = order === 'desc' ? -1 : 1;
  const [rows, total] = await Promise.all([
    Category.find().sort({ [field]: dir }).skip((p - 1) * l).limit(l).lean(),
    Category.countDocuments(),
  ]);
  const items = await Promise.all(rows.map(async (c) => {
    const count = await OrderCategory.countDocuments({ category: c._id });
    return { ...c, inUse: count > 0 };
  }));
  return { items, total, page: p, limit: l };
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
