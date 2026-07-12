const ExpenseCategory = require('../models/expenseCategory');
const Expense = require('../models/expense');

exports.getAllExpenseCategories = async () => {
  // Return categories with `inUse` flag when referenced by any Expense
  const categories = await ExpenseCategory.find().lean();
  return await Promise.all(categories.map(async (c) => {
    const count = await Expense.countDocuments({ expenseType: c._id });
    return { ...c, inUse: count > 0 };
  }));
};

const EXPENSE_CATEGORY_SORTABLE = new Set(['displayName', 'name', 'type']);

exports.getExpenseCategoriesPaginated = async ({ page = 1, limit = 10, sort = 'displayName', order = 'asc' } = {}) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, parseInt(limit) || 10);
  const field = EXPENSE_CATEGORY_SORTABLE.has(sort) ? sort : 'displayName';
  const dir = order === 'desc' ? -1 : 1;
  const [rows, total] = await Promise.all([
    ExpenseCategory.find().sort({ [field]: dir }).skip((p - 1) * l).limit(l).lean(),
    ExpenseCategory.countDocuments(),
  ]);
  const items = await Promise.all(rows.map(async (c) => {
    const count = await Expense.countDocuments({ expenseType: c._id });
    return { ...c, inUse: count > 0 };
  }));
  return { items, total, page: p, limit: l };
};

exports.getExpenseCategoryById = async (id) => {
  return await ExpenseCategory.findById(id);
};

exports.createExpenseCategory = async (data) => {
  const category = new ExpenseCategory(data);
  return await category.save();
};

exports.updateExpenseCategory = async (id, data) => {
  // Prevent changing the cash flow direction (inflow <-> outflow) once the
  // category is referenced by any Expense, since it would misclassify existing records.
  if (data && (data.type === 'inflow' || data.type === 'outflow')) {
    const existing = await ExpenseCategory.findById(id);
    if (!existing) return null;
    if (existing.type !== data.type) {
      const inUse = await Expense.countDocuments({ expenseType: id });
      if (inUse > 0) {
        throw new Error('This cash flow category is in use and its type cannot be changed');
      }
    }
  }
  return await ExpenseCategory.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
};

exports.deleteExpenseCategory = async (id) => {
  // Prevent deletion if referenced by any Expense
  const inUse = await Expense.countDocuments({ expenseType: id });
  if (inUse > 0) {
    throw new Error('This cash flow category is in use and cannot be deleted');
  }
  return await ExpenseCategory.findByIdAndDelete(id);
};
