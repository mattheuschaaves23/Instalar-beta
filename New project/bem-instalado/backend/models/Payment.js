const { createModel } = require('./baseModel');

module.exports = createModel('payments', {
  hasUserId: true,
  defaultOrderBy: 'created_at DESC',
});
