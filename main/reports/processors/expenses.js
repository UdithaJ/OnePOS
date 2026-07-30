// Expenses (Cash Outflow) — outflow expenses excluding bank deposits, which
// are reported separately by bank-reconciliation.

const mongoose = require('mongoose');

exports.buildPipeline = ({ params }) => {
  const match = { date: { $gte: params.fromDate, $lte: params.toDate } };
  if (params.expenseTypeId && params.expenseTypeId !== 'all') {
    match.expenseType = mongoose.Types.ObjectId.createFromHexString(params.expenseTypeId);
  }

  return [
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
        date: 1,
        description: '$category.displayName',
        amount: 1,
      },
    },
    { $sort: { date: 1 } },
  ];
};
