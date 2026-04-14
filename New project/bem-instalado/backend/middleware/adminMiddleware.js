const pool = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, is_admin
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Acesso restrito ao administrador do sistema.' });
    }

    return next();
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao validar permissão de administrador.' });
  }
};
