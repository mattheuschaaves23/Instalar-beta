const pool = require('../config/database');

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

exports.createClient = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      street,
      house_number,
      neighborhood,
      city,
      state,
      zip_code,
      address_reference,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO clients (
          user_id,
          name,
          phone,
          email,
          address,
          street,
          house_number,
          neighborhood,
          city,
          state,
          zip_code,
          address_reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        req.userId,
        String(name).trim(),
        String(phone).trim(),
        normalizeNullableString(email),
        normalizeNullableString(address),
        normalizeNullableString(street),
        normalizeNullableString(house_number),
        normalizeNullableString(neighborhood),
        normalizeNullableString(city),
        normalizeNullableString(state),
        normalizeNullableString(zip_code),
        normalizeNullableString(address_reference),
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
};

exports.getClients = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
};

exports.getClient = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      street,
      house_number,
      neighborhood,
      city,
      state,
      zip_code,
      address_reference,
    } = req.body;

    const { rows } = await pool.query(
      `
        UPDATE clients
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          address = COALESCE($4, address),
          street = COALESCE($5, street),
          house_number = COALESCE($6, house_number),
          neighborhood = COALESCE($7, neighborhood),
          city = COALESCE($8, city),
          state = COALESCE($9, state),
          zip_code = COALESCE($10, zip_code),
          address_reference = COALESCE($11, address_reference),
          updated_at = NOW()
        WHERE id = $12 AND user_id = $13
        RETURNING *
      `,
      [
        normalizeNullableString(name),
        normalizeNullableString(phone),
        normalizeNullableString(email),
        normalizeNullableString(address),
        normalizeNullableString(street),
        normalizeNullableString(house_number),
        normalizeNullableString(neighborhood),
        normalizeNullableString(city),
        normalizeNullableString(state),
        normalizeNullableString(zip_code),
        normalizeNullableString(address_reference),
        req.params.id,
        req.userId,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
};
