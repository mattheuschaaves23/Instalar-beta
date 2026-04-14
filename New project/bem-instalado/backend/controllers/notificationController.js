const pool = require('../config/database');

exports.getNotifications = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar notificações.' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        UPDATE notifications
        SET read = true
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Notificação não encontrada.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar notificação.' });
  }
};
