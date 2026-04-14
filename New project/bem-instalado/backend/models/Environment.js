const { createModel } = require('./baseModel');

module.exports = createModel('environments', {
  hasUserId: false,
  defaultOrderBy: 'id ASC',
});
