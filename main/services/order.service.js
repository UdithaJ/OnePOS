const Category = require('../models/category');

/**
 * @param {{ categoryId: string, weight: number }[]} categoryLinesInput
 * @returns {{ totalAmount: number, categoryLines: { categoryId: import('mongoose').Types.ObjectId, weight: number }[] }}
 */
async function calculateTotals(categoryLinesInput) {
  if (!Array.isArray(categoryLinesInput) || categoryLinesInput.length === 0) {
    throw new Error('categoryLines must be a non-empty array');
  }

  const categoryLines = [];
  let totalAmount = 0;

  for (const line of categoryLinesInput) {
    const id = line.categoryId;
    const weight = Number(line.weight);
    if (Number.isNaN(weight) || weight < 0) {
      throw new Error('Each line must have a valid non-negative weight');
    }

    const cat = await Category.findById(id);
    if (!cat) {
      throw new Error(`Category not found: ${id}`);
    }
    if (!cat.isActive) {
      throw new Error(`Category is inactive: ${cat.name}`);
    }

    const byWeight = weight * cat.pricePerKg;
    const lineTotal = Math.max(byWeight, cat.minPrice);
    totalAmount += lineTotal;

    categoryLines.push({
      categoryId: cat._id,
      weight,
    });
  }

  return { totalAmount, categoryLines };
}

/**
 * Strips client-supplied totals and sets computed totalAmount, dueAmount, and normalized categoryLines.
 */
async function prepareOrderPayload(body) {
  const {
    categoryLines: rawLines,
    paymentStatus = 'unpaid',
    totalAmount: _ignoreTotal,
    dueAmount: _ignoreDue,
    ...rest
  } = body;

  const { totalAmount, categoryLines } = await calculateTotals(rawLines);

  let dueAmount;
  if (paymentStatus === 'paid') {
    dueAmount = 0;
  } else {
    dueAmount = totalAmount;
  }

  return {
    ...rest,
    categoryLines,
    paymentStatus,
    totalAmount,
    dueAmount,
  };
}

module.exports = {
  calculateTotals,
  prepareOrderPayload,
};
