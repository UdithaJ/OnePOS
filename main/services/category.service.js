const Category = require('../models/category');
const OrderCategory = require('../models/orderCategory');

exports.createCategory = async (data) => {
  const category = new Category(data);
  return await category.save();
};

exports.updateCategory = async (id, data) => {
  return await Category.findByIdAndUpdate(id, data, { new: true });
};

// Marks each category `inUse` when any order item refers to it (a used
// category cannot be deleted). One indexed query for the whole list, rather
// than a count per category.
async function withUsage(categories) {
  const used = await OrderCategory.distinct('category', { category: { $in: categories.map((c) => c._id) } });
  const usedIds = new Set(used.map(String));
  return categories.map((c) => ({ ...c, inUse: usedIds.has(String(c._id)) }));
}
exports.withUsage = withUsage;

// The order form only needs names and prices, so it asks without `inUse`.
exports.getAllCategories = async ({ usage = true } = {}) => {
  const categories = await Category.find().lean();
  return usage ? await withUsage(categories) : categories;
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
  const items = await withUsage(rows);
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
