const expenseCategoryService = require('../services/expenseCategory.service');

exports.getAll = async (req, res) => {
  try {
    const categories = await expenseCategoryService.getAllExpenseCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPaginated = async (req, res) => {
  try {
    const result = await expenseCategoryService.getExpenseCategoriesPaginated(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const category = await expenseCategoryService.getExpenseCategoryById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Expense category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const category = await expenseCategoryService.createExpenseCategory(req.body);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A cashflow category with this name already exists.' });
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const category = await expenseCategoryService.updateExpenseCategory(req.params.id, req.body);
    if (!category) return res.status(404).json({ message: 'Expense category not found' });
    res.json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A cashflow category with this name already exists.' });
    res.status(400).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const deleted = await expenseCategoryService.deleteExpenseCategory(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Expense category not found' });
    res.json({ message: 'Expense category deleted' });
  } catch (err) {
    // Return 400 for validation/usage errors so client can show friendly messages
    res.status(400).json({ message: err.message });
  }
};
