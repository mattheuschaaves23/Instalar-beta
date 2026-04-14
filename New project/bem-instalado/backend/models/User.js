const { createModel } = require('./baseModel');

module.exports = createModel('users', {
  hasUserId: false,
  defaultOrderBy: 'created_at DESC',
});
