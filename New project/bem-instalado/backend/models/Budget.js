const { createModel } = require('./baseModel');

module.exports = createModel('budgets', {
  hasUserId: true,
  defaultOrderBy: 'created_at DESC',
});
