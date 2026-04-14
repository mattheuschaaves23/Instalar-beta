const pool = require('../config/database');

function normalizeString(value) {
  return String(value || '').trim();
}

function firstFilled(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function buildDestination(schedule) {
  const street = firstFilled(schedule.service_street, schedule.client_street);
  const number = firstFilled(schedule.service_number, schedule.client_house_number);
  const neighborhood = firstFilled(schedule.service_neighborhood, schedule.client_neighborhood);
  const city = firstFilled(schedule.service_city, schedule.client_city);
  const state = firstFilled(schedule.service_state, schedule.client_state);
  const zipCode = firstFilled(schedule.service_zip_code, schedule.client_zip_code);
  const reference = firstFilled(schedule.service_reference, schedule.client_address_reference);

  const line1 = [street, number && `Nº ${number}`].filter(Boolean).join(', ');
  const line2 = [neighborhood, [city, state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const formatted = [line1, line2, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' • ');

  const fullAddress = firstFilled(schedule.service_full_address, formatted, schedule.client_address);
  const routeQuery = firstFilled(fullAddress, line1, line2);

  return {
    street: street || null,
    house_number: number || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    zip_code: zipCode || null,
    reference: reference || null,
    full_address: fullAddress || null,
    route_query: routeQuery || null,
  };
}

function buildRouteLinks(routeQuery) {
  if (!routeQuery) {
    return { google_maps: null, waze: null };
  }

  const encoded = encodeURIComponent(routeQuery);
  return {
    google_maps: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}

exports.getSchedules = async (req, res) => {
  try {
    const params = [req.userId];
    let query = `
      SELECT
        s.*,
        c.name AS client_name,
        c.address AS client_address,
        c.street AS client_street,
        c.house_number AS client_house_number,
        c.neighborhood AS client_neighborhood,
        c.city AS client_city,
        c.state AS client_state,
        c.zip_code AS client_zip_code,
        c.address_reference AS client_address_reference
      FROM schedules s
      JOIN clients c ON c.id = s.client_id
      WHERE s.user_id = $1
    `;

    if (req.query.start && req.query.end) {
      query += ' AND s.date BETWEEN $2 AND $3';
      params.push(req.query.start, req.query.end);
    }

    query += ' ORDER BY s.date ASC';

    const { rows } = await pool.query(query, params);
    const schedules = rows.map((row) => {
      const destination = buildDestination(row);
      const route_links = buildRouteLinks(destination.route_query);

      return {
        ...row,
        destination,
        route_links,
      };
    });

    return res.json(schedules);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar agenda.' });
  }
};

exports.updateScheduleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['scheduled', 'completed', 'canceled']);

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Status inválido para agendamento.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE schedules
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [normalizedStatus, req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar agenda.' });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM schedules
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir evento.' });
  }
};
