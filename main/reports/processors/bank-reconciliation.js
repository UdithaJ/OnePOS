// Bank Transfer Reconciliation — bank-deposit expenses in the period.

exports.buildPipeline = ({ params }) => [
  { $match: { date: { $gte: params.fromDate, $lte: params.toDate } } },
  {
    $lookup: {
      from: 'expensecategories',
      localField: 'expenseType',
      foreignField: '_id',
      as: 'category',
    },
  },
  { $unwind: '$category' },
  { $match: { 'category.displayName': { $regex: /^bank deposite$/i } } },
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
