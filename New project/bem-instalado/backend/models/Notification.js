const { createModel } = require('./baseModel');

module.exports = createModel('notifications', {
  hasUserId: true,
  defaultOrderBy: 'created_at DESC',
});
