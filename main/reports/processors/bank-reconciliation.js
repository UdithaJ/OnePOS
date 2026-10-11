// Bank Transfer Reconciliation — bank-deposit expenses in the period.

const { resolveDateBasis, periodStages } = require('./shared/businessDay.js');
const { BANK_DEPOSIT_REGEX } = require('./shared/bankDeposit.js');

exports.buildPipeline = ({ params }) => {
  const basis = resolveDateBasis(params.dateBasis);

  return [
    ...periodStages({ basis, dateField: 'date', fromDate: params.fromDate, toDate: params.toDate }),
    {
      $lookup: {
        from: 'expensecategories',
        localField: 'expenseType',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    { $match: { 'category.displayName': { $regex: BANK_DEPOSIT_REGEX } } },
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
