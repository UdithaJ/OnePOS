// Expenses (Cash Outflow) — outflow expenses excluding bank deposits, which
// are reported separately by bank-reconciliation.

const mongoose = require('mongoose');
const { resolveDateBasis, periodStages } = require('./shared/businessDay.js');

exports.buildPipeline = ({ params }) => {
  const basis = resolveDateBasis(params.dateBasis);
  const match = {};
  if (params.expenseTypeId && params.expenseTypeId !== 'all') {
    match.expenseType = mongoose.Types.ObjectId.createFromHexString(params.expenseTypeId);
  }

  return [
    ...periodStages({ basis, dateField: 'date', fromDate: params.fromDate, toDate: params.toDate }),
    { $match: match },
    {
      $lookup: {
        from: 'expensecategories',
        localField: 'expenseType',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $match: {
        'category.type': 'outflow',
        'category.displayName': { $not: { $regex: /^bank deposite$/i } },
      },
    },
    {
      $project: {
        _id: 0,
        expenseId: '$_id',
        // The Date column and the day grouping follow the chosen basis.
        date: basis === 'business' ? '$businessDate' : 1,
        description: '$category.displayName',
        amount: 1,
      },
    },
    { $sort: { date: 1 } },
  ];
};
