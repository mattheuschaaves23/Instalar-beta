const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const result = await pool.query(
      `
        SELECT
          id,
          amount,
          status,
          method,
          provider,
          external_id,
          provider_payment_id,
          created_at,
          updated_at
        FROM payments
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [req.userId, limit]
    );

    return res.json({ payments: result.rows });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar pagamentos.' });
  }
});

module.exports = router;
