const { createModel } = require('./baseModel');

module.exports = createModel('schedules', {
  hasUserId: true,
  defaultOrderBy: 'date ASC',
});
