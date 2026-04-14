const pool = require('../config/database');

function sanitizeLimit(value, fallback = 50, max = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function createModel(tableName, options = {}) {
  const {
    idColumn = 'id',
    hasUserId = false,
    defaultOrderBy = 'created_at DESC',
    select = '*',
  } = options;

  return {
    tableName,

    async findById(id) {
      const result = await pool.query(
        `
          SELECT ${select}
          FROM ${tableName}
          WHERE ${idColumn} = $1
          LIMIT 1
        `,
        [id]
      );

      return result.rows[0] || null;
    },

    async findAll(limit = 50) {
      const safeLimit = sanitizeLimit(limit);
      const result = await pool.query(
        `
          SELECT ${select}
          FROM ${tableName}
          ORDER BY ${defaultOrderBy}
          LIMIT $1
        `,
        [safeLimit]
      );

      return result.rows;
    },

    async findByUserId(userId, limit = 50) {
      if (!hasUserId) {
        throw new Error(`Model ${tableName} não possui coluna user_id configurada.`);
      }

      const safeLimit = sanitizeLimit(limit);
      const result = await pool.query(
        `
          SELECT ${select}
          FROM ${tableName}
          WHERE user_id = $1
          ORDER BY ${defaultOrderBy}
          LIMIT $2
        `,
        [userId, safeLimit]
      );

      return result.rows;
    },
  };
}

module.exports = {
  createModel,
};
