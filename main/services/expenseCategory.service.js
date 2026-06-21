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

exports.getExpenseCategoryById = async (id) => {
  return await ExpenseCategory.findById(id);
};

exports.createExpenseCategory = async (data) => {
  const category = new ExpenseCategory(data);
  return await category.save();
};

exports.updateExpenseCategory = async (id, data) => {
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
