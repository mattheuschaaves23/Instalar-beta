const pool = require('../config/database');
const { buildAvailableDates, normalizeInstallationDays } = require('../utils/installerAvailability');

function normalizeStringList(values, maxItems = 8) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeGallery(value) {
  if (Array.isArray(value)) {
    return normalizeStringList(value, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringList(parsed, 10);
    } catch (_error) {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) {
      return normalizeStringList(value.items, 10);
    }
  }

  return [];
}

function calculateProfileCompleteness(profile) {
  const checkpoints = [
    profile.business_name,
    profile.phone,
    profile.logo,
    profile.installer_photo,
    profile.city,
    profile.state,
    profile.service_region,
    profile.bio,
    profile.installation_method,
    Array.isArray(profile.installation_days) && profile.installation_days.length > 0,
    Number(profile.base_service_cost || 0) > 0,
    Number(profile.default_price_per_roll || 0) > 0,
    Array.isArray(profile.installation_gallery) && profile.installation_gallery.length > 0,
    profile.certificate_file,
    profile.document_type,
    profile.document_id,
    Number(profile.warranty_days || 0) > 0,
  ];

  const completed = checkpoints.filter(Boolean).length;
  return Math.round((completed / checkpoints.length) * 100);
}

function buildMotivationalNotes(metrics) {
  const notes = [];

  if (metrics.goal_progress >= 100) {
    notes.push({
      title: 'Meta batida',
      description: 'Seu faturamento do mês já passou da meta. Hora de subir ticket médio e reputação.',
    });
  } else if (metrics.goal_progress >= 65) {
    notes.push({
      title: 'Você está perto',
      description: 'Mais alguns fechamentos aprovados já colocam o mês no nível ideal.',
    });
  } else {
    notes.push({
      title: 'Acelere a prospecção',
      description: 'Use as datas disponíveis e o PDF para transformar conversas em aprovações.',
    });
  }

  if (metrics.average_rating >= 4.7 && metrics.review_count >= 2) {
    notes.push({
      title: 'Reputação premium',
      description: 'Sua nota está alta. Destaque isso nas conversas e no perfil público.',
    });
  } else {
    notes.push({
      title: 'Busque novas avaliações',
      description: 'Cada avaliação positiva melhora seu posicionamento no ranking de instaladores.',
    });
  }

  if (metrics.available_dates.length <= 2) {
    notes.push({
      title: 'Agenda aquecida',
      description: 'Poucas datas livres. Hora de elevar margem e priorizar clientes com decisão rápida.',
    });
  } else {
    notes.push({
      title: 'Espaços para vender',
      description: 'Você ainda tem boas janelas na agenda. Aproveite para puxar novas propostas.',
    });
  }

  return notes;
}

function dateKey(date) {
  const safeDate = new Date(date);
  const month = `${safeDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${safeDate.getDate()}`.padStart(2, '0');
  return `${safeDate.getFullYear()}-${month}-${day}`;
}

function normalizeMonthKey(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const match = raw.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthRange(monthKey) {
  const baseMonth = normalizeMonthKey(monthKey) || dateKey(new Date()).slice(0, 7);
  const [year, month] = baseMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    month: baseMonth,
    startDate: dateKey(start),
    endDate: dateKey(end),
  };
}

function normalizeDateInput(value) {
  const raw = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return '';
  }

  const parsed = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return dateKey(parsed) === raw ? raw : '';
}

function normalizeTimeInput(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return '';
  }

  return `${match[1]}:${match[2]}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00')
    .split(':')
    .map((part) => Number(part));
  return hours * 60 + minutes;
}

function serializeAvailabilitySlot(slot) {
  const safeDate = slot.slot_date instanceof Date
    ? dateKey(slot.slot_date)
    : String(slot.slot_date || '').slice(0, 10);
  const start = String(slot.start_time || '').slice(0, 5);
  const end = String(slot.end_time || '').slice(0, 5);

  return {
    id: slot.id,
    slot_date: safeDate,
    start_time: start,
    end_time: end,
  };
}

async function getTopInstallers(limit = 5) {
  const { rows } = await pool.query(
    `
      WITH ranked_installers AS (
        SELECT
          u.id,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name,
          u.city,
          u.state,
          COALESCE(reviews.average_rating, 0) AS average_rating,
          COALESCE(reviews.review_count, 0)::int AS review_count,
          COALESCE(budget_stats.approved_jobs, 0)::int AS approved_jobs,
          COALESCE(budget_stats.unique_clients_served, 0)::int AS unique_clients_served,
          COALESCE(schedule_stats.completed_jobs, 0)::int AS completed_jobs,
          COALESCE(schedule_stats.completed_unique_clients, 0)::int AS completed_unique_clients,
          LEAST(
            COALESCE(schedule_stats.completed_unique_clients, 0),
            COALESCE(reviews.review_count, 0) * 3 + 2
          )::int AS trusted_clients_score,
          LEAST(
            COALESCE(budget_stats.unique_clients_served, 0),
            COALESCE(reviews.review_count, 0) * 3 + 2
          )::int AS trusted_sales_score,
          RANK() OVER (
            ORDER BY
              COALESCE(reviews.average_rating, 0) DESC,
              COALESCE(reviews.review_count, 0) DESC,
              LEAST(
                COALESCE(schedule_stats.completed_unique_clients, 0),
                COALESCE(reviews.review_count, 0) * 3 + 2
              ) DESC,
              LEAST(
                COALESCE(budget_stats.unique_clients_served, 0),
                COALESCE(reviews.review_count, 0) * 3 + 2
              ) DESC,
              u.created_at ASC
          )::int AS ranking_position
        FROM users u
        LEFT JOIN (
          SELECT installer_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
          FROM installer_reviews
          GROUP BY installer_id
        ) reviews ON reviews.installer_id = u.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved_jobs,
            COUNT(DISTINCT client_id) FILTER (WHERE status = 'approved') AS unique_clients_served
          FROM budgets
          GROUP BY user_id
        ) budget_stats ON budget_stats.user_id = u.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
            COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') AS completed_unique_clients
          FROM schedules
          GROUP BY user_id
        ) schedule_stats ON schedule_stats.user_id = u.id
        WHERE COALESCE(u.public_profile, true) = true
          AND (
            COALESCE(reviews.review_count, 0) > 0
            OR COALESCE(schedule_stats.completed_unique_clients, 0) > 0
            OR COALESCE(budget_stats.unique_clients_served, 0) > 0
          )
      )
      SELECT *
      FROM ranked_installers
      ORDER BY ranking_position ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

exports.getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          phone,
          logo,
          installer_photo,
          COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
          certificate_file,
          certificate_name,
          certification_verified,
          featured_installer,
          business_name,
          city,
          state,
          service_region,
          bio,
          installation_method,
          service_hours,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          base_service_cost,
          travel_fee,
          monthly_goal,
          public_profile,
          years_experience,
          wallpaper_store_recommended,
          document_type,
          document_id,
          emergency_contact,
          emergency_phone,
          safety_notes,
          accepts_service_contract,
          provides_warranty,
          warranty_days,
          two_factor_enabled
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const profile = {
      ...rows[0],
      installation_gallery: normalizeGallery(rows[0]?.installation_gallery),
    };
    return res.json(profile);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar perfil.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      logo,
      installer_photo,
      installation_gallery,
      certificate_file,
      certificate_name,
      business_name,
      city,
      state,
      service_region,
      bio,
      installation_method,
      service_hours,
      installation_days,
      default_price_per_roll,
      default_removal_price,
      base_service_cost,
      travel_fee,
      monthly_goal,
      public_profile,
      years_experience,
      wallpaper_store_recommended,
      document_type,
      document_id,
      emergency_contact,
      emergency_phone,
      safety_notes,
      accepts_service_contract,
      provides_warranty,
      warranty_days,
    } = req.body;

    const normalizedDays = normalizeInstallationDays(installation_days);
    const normalizedGallery = normalizeGallery(installation_gallery);

    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          logo = COALESCE($3, logo),
          installer_photo = COALESCE($4, installer_photo),
          installation_gallery = CASE WHEN $5::jsonb IS NULL THEN installation_gallery ELSE $5::jsonb END,
          certificate_file = COALESCE($6, certificate_file),
          certificate_name = COALESCE($7, certificate_name),
          business_name = COALESCE($8, business_name),
          city = COALESCE($9, city),
          state = COALESCE($10, state),
          service_region = COALESCE($11, service_region),
          bio = COALESCE($12, bio),
          installation_method = COALESCE($13, installation_method),
          service_hours = COALESCE($14, service_hours),
          installation_days = CASE WHEN $15::TEXT[] IS NULL THEN installation_days ELSE $15::TEXT[] END,
          default_price_per_roll = COALESCE($16, default_price_per_roll),
          default_removal_price = COALESCE($17, default_removal_price),
          base_service_cost = COALESCE($18, base_service_cost),
          travel_fee = COALESCE($19, travel_fee),
          monthly_goal = COALESCE($20, monthly_goal),
          public_profile = COALESCE($21, public_profile),
          years_experience = COALESCE($22, years_experience),
          wallpaper_store_recommended = COALESCE($23, wallpaper_store_recommended),
          document_type = COALESCE($24, document_type),
          document_id = COALESCE($25, document_id),
          emergency_contact = COALESCE($26, emergency_contact),
          emergency_phone = COALESCE($27, emergency_phone),
          safety_notes = COALESCE($28, safety_notes),
          accepts_service_contract = COALESCE($29, accepts_service_contract),
          provides_warranty = COALESCE($30, provides_warranty),
          warranty_days = COALESCE($31, warranty_days),
          updated_at = NOW()
        WHERE id = $32
        RETURNING
          id,
          name,
          email,
          phone,
          logo,
          installer_photo,
          COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
          certificate_file,
          certificate_name,
          certification_verified,
          featured_installer,
          business_name,
          city,
          state,
          service_region,
          bio,
          installation_method,
          service_hours,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          base_service_cost,
          travel_fee,
          monthly_goal,
          public_profile,
          years_experience,
          wallpaper_store_recommended,
          document_type,
          document_id,
          emergency_contact,
          emergency_phone,
          safety_notes,
          accepts_service_contract,
          provides_warranty,
          warranty_days,
          two_factor_enabled
      `,
      [
        name ?? null,
        phone ?? null,
        logo ?? null,
        installer_photo ?? null,
        Array.isArray(installation_gallery) ? JSON.stringify(normalizedGallery) : null,
        certificate_file ?? null,
        certificate_name ?? null,
        business_name ?? null,
        city ?? null,
        state ?? null,
        service_region ?? null,
        bio ?? null,
        installation_method ?? null,
        service_hours ?? null,
        Array.isArray(installation_days) ? normalizedDays : null,
        default_price_per_roll ?? null,
        default_removal_price ?? null,
        base_service_cost ?? null,
        travel_fee ?? null,
        monthly_goal ?? null,
        public_profile ?? null,
        years_experience ?? null,
        wallpaper_store_recommended ?? null,
        document_type ?? null,
        document_id ?? null,
        emergency_contact ?? null,
        emergency_phone ?? null,
        safety_notes ?? null,
        accepts_service_contract ?? null,
        provides_warranty ?? null,
        warranty_days ?? null,
        req.userId,
      ]
    );

    const profile = {
      ...rows[0],
      installation_gallery: normalizeGallery(rows[0]?.installation_gallery),
    };
    return res.json(profile);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
};

exports.getAvailabilitySlots = async (req, res) => {
  try {
    if (req.query.month && !normalizeMonthKey(req.query.month)) {
      return res.status(400).json({ error: 'Mês inválido. Use o formato YYYY-MM.' });
    }

    const range = getMonthRange(req.query.month);
    const { rows } = await pool.query(
      `
        SELECT
          id,
          slot_date,
          start_time::text AS start_time,
          end_time::text AS end_time
        FROM installer_availability_slots
        WHERE user_id = $1
          AND is_active = TRUE
          AND slot_date >= $2::date
          AND slot_date < $3::date
        ORDER BY slot_date ASC, start_time ASC
      `,
      [req.userId, range.startDate, range.endDate]
    );

    return res.json({
      month: range.month,
      slots: rows.map(serializeAvailabilitySlot),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar horários vagos.' });
  }
};

exports.createAvailabilitySlot = async (req, res) => {
  try {
    const slotDate = normalizeDateInput(req.body.slot_date);
    const startTime = normalizeTimeInput(req.body.start_time);
    const endTime = normalizeTimeInput(req.body.end_time);
    const today = dateKey(new Date());

    if (!slotDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Data e horários válidos são obrigatórios.' });
    }

    if (slotDate < today) {
      return res.status(400).json({ error: 'Não é possível criar horário em data passada.' });
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return res.status(400).json({ error: 'O horário final deve ser maior que o inicial.' });
    }

    const [overlapResult, scheduledResult] = await Promise.all([
      pool.query(
        `
          SELECT id
          FROM installer_availability_slots
          WHERE user_id = $1
            AND is_active = TRUE
            AND slot_date = $2::date
            AND start_time < $4::time
            AND end_time > $3::time
          LIMIT 1
        `,
        [req.userId, slotDate, startTime, endTime]
      ),
      pool.query(
        `
          SELECT id
          FROM schedules
          WHERE user_id = $1
            AND status <> 'canceled'
            AND DATE(date) = $2::date
            AND date::time >= $3::time
            AND date::time < $4::time
          LIMIT 1
        `,
        [req.userId, slotDate, startTime, endTime]
      ),
    ]);

    if (overlapResult.rowCount > 0) {
      return res.status(409).json({ error: 'Já existe horário vago nesse intervalo.' });
    }

    if (scheduledResult.rowCount > 0) {
      return res.status(409).json({ error: 'Esse intervalo já está ocupado por um agendamento.' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO installer_availability_slots (
          user_id,
          slot_date,
          start_time,
          end_time
        )
        VALUES ($1, $2::date, $3::time, $4::time)
        RETURNING
          id,
          slot_date,
          start_time::text AS start_time,
          end_time::text AS end_time
      `,
      [req.userId, slotDate, startTime, endTime]
    );

    return res.status(201).json(serializeAvailabilitySlot(rows[0]));
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao salvar horário vago.' });
  }
};

exports.deleteAvailabilitySlot = async (req, res) => {
  try {
    const slotId = Number(req.params.id);

    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }

    const { rowCount } = await pool.query(
      `
        DELETE FROM installer_availability_slots
        WHERE id = $1
          AND user_id = $2
      `,
      [slotId, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Horário não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir horário vago.' });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const [profileResult, budgetResult, scheduleResult, reviewResult, rankingResult, topInstallers] =
      await Promise.all([
        pool.query(
          `
            SELECT
              id,
              name,
              business_name,
              city,
              state,
              service_region,
              logo,
              installer_photo,
              COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
              certificate_file,
              certificate_name,
              certification_verified,
              featured_installer,
              monthly_goal,
              public_profile,
              wallpaper_store_recommended,
              document_type,
              document_id,
              warranty_days,
              COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
              default_price_per_roll,
              base_service_cost,
              bio,
              installation_method,
              service_hours,
              phone
            FROM users
            WHERE id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COALESCE(SUM(total_amount) FILTER (
                WHERE status = 'approved'
                  AND DATE_TRUNC('month', COALESCE(approved_date, created_at)) = DATE_TRUNC('month', CURRENT_DATE)
              ), 0) AS monthly_revenue,
              COUNT(*) FILTER (
                WHERE status = 'approved'
                  AND DATE_TRUNC('month', COALESCE(approved_date, created_at)) = DATE_TRUNC('month', CURRENT_DATE)
              )::int AS approved_this_month,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_budgets
            FROM budgets
            WHERE user_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COUNT(*) FILTER (
                WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
                  AND date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
              )::int AS week_installations,
              COUNT(*) FILTER (
                WHERE status = 'completed'
                  AND date >= DATE_TRUNC('week', CURRENT_DATE)
                  AND date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
              )::int AS completed_this_week,
              ARRAY_REMOVE(
                ARRAY_AGG(date ORDER BY date ASC) FILTER (
                  WHERE date >= CURRENT_DATE
                    AND date < CURRENT_DATE + INTERVAL '35 days'
                    AND status <> 'canceled'
                ),
                NULL
              ) AS busy_dates
            FROM schedules
            WHERE user_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COALESCE(AVG(rating), 0) AS average_rating,
              COUNT(*)::int AS review_count
            FROM installer_reviews
            WHERE installer_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            WITH ranked_installers AS (
              SELECT
                u.id,
                RANK() OVER (
                  ORDER BY
                    COALESCE(reviews.average_rating, 0) DESC,
                    COALESCE(reviews.review_count, 0) DESC,
                    LEAST(
                      COALESCE(schedule_stats.completed_unique_clients, 0),
                      COALESCE(reviews.review_count, 0) * 3 + 2
                    ) DESC,
                    LEAST(
                      COALESCE(budget_stats.unique_clients_served, 0),
                      COALESCE(reviews.review_count, 0) * 3 + 2
                    ) DESC,
                    u.created_at ASC
                )::int AS ranking_position
              FROM users u
              LEFT JOIN (
                SELECT installer_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
                FROM installer_reviews
                GROUP BY installer_id
              ) reviews ON reviews.installer_id = u.id
              LEFT JOIN (
                SELECT
                  user_id,
                  COUNT(*) FILTER (WHERE status = 'approved') AS approved_jobs,
                  COUNT(DISTINCT client_id) FILTER (WHERE status = 'approved') AS unique_clients_served
                FROM budgets
                GROUP BY user_id
              ) budget_stats ON budget_stats.user_id = u.id
              LEFT JOIN (
                SELECT
                  user_id,
                  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
                  COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') AS completed_unique_clients
                FROM schedules
                GROUP BY user_id
              ) schedule_stats ON schedule_stats.user_id = u.id
              WHERE COALESCE(u.public_profile, true) = true
                AND (
                  COALESCE(reviews.review_count, 0) > 0
                  OR COALESCE(schedule_stats.completed_unique_clients, 0) > 0
                  OR COALESCE(budget_stats.unique_clients_served, 0) > 0
                )
            )
            SELECT ranking_position
            FROM ranked_installers
            WHERE id = $1
          `,
          [req.userId]
        ),
        getTopInstallers(5),
      ]);

    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const budgetMetrics = budgetResult.rows[0] || {};
    const scheduleMetrics = scheduleResult.rows[0] || {};
    const reviewMetrics = reviewResult.rows[0] || {};
    const monthlyRevenue = Number(budgetMetrics.monthly_revenue || 0);
    const monthlyGoal = Number(profile.monthly_goal || 0);
    const goalProgress = monthlyGoal > 0 ? Math.min(100, Math.round((monthlyRevenue / monthlyGoal) * 100)) : 0;
    const availableDates = buildAvailableDates(profile.installation_days, scheduleMetrics.busy_dates || [], 5);
    const averageRating = Number(reviewMetrics.average_rating || 0);

    const metrics = {
      monthly_revenue: monthlyRevenue,
      installations_this_week: Number(scheduleMetrics.week_installations || 0),
      completed_this_week: Number(scheduleMetrics.completed_this_week || 0),
      available_dates: availableDates,
      ranking_position: rankingResult.rows[0]?.ranking_position || null,
      average_rating: averageRating,
      review_count: Number(reviewMetrics.review_count || 0),
      approved_this_month: Number(budgetMetrics.approved_this_month || 0),
      pending_budgets: Number(budgetMetrics.pending_budgets || 0),
      monthly_goal: monthlyGoal,
      goal_progress: goalProgress,
      public_profile: Boolean(profile.public_profile),
      profile_completeness: calculateProfileCompleteness(profile),
    };

    return res.json({
      profile: {
        name: profile.name,
        business_name: profile.business_name,
        city: profile.city,
        state: profile.state,
        service_region: profile.service_region,
        public_profile: profile.public_profile,
      },
      metrics,
      motivation: buildMotivationalNotes(metrics),
      ranking: topInstallers,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao montar o dashboard.' });
  }
};
