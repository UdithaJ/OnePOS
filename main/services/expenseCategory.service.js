const ExpenseCategory = require('../models/expenseCategory');

exports.getAllExpenseCategories = async () => {
  return await ExpenseCategory.find();
};

exports.getExpenseCategoryById = async (id) => {
  return await ExpenseCategory.findById(id);
};

exports.createExpenseCategory = async (data) => {
  const category = new ExpenseCategory(data);
  return await category.save();
};

exports.updateExpenseCategory = async (id, data) => {
  return await ExpenseCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

exports.deleteExpenseCategory = async (id) => {
  return await ExpenseCategory.findByIdAndDelete(id);
};
