const { createModel } = require('./baseModel');

module.exports = createModel('clients', {
  hasUserId: true,
  defaultOrderBy: 'created_at DESC',
});
