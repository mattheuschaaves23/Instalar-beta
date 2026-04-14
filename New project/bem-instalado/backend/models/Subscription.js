const { createModel } = require('./baseModel');

module.exports = createModel('subscriptions', {
  hasUserId: true,
  defaultOrderBy: 'created_at DESC',
});
