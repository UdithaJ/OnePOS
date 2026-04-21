const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Create a category
router.post('/', categoryController.createCategory);

// Update a category
router.patch('/:id', categoryController.updateCategory);

// Get all categories
router.get('/', categoryController.getAllCategories);

// Get one category
router.get('/:id', categoryController.getCategoryById);

module.exports = router;
