const crypto = require('crypto');
const pool = require('../config/database');
const { buildAvailableDates } = require('../utils/installerAvailability');
const generateWhatsAppLink = require('../utils/whatsapp');
const reverseGeocode = require('../utils/reverseGeocode');

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || 'https://www.beminstalado.com.br';
const MARKETPLACE_CTA_LABEL = process.env.MARKETPLACE_CTA_LABEL || 'Visitar loja oficial';
const MARKETPLACE_WHATSAPP_URL =
  process.env.MARKETPLACE_WHATSAPP_URL || 'https://api.whatsapp.com/send?phone=5548999816000';
const MARKETPLACE_CONTACT_PHONE = process.env.MARKETPLACE_CONTACT_PHONE || '(48) 99981-6000';
const MARKETPLACE_CONTACT_EMAIL = process.env.MARKETPLACE_CONTACT_EMAIL || 'beminstaladohd@gmail.com';

function buildMarketplacePayload() {
  return {
    title: 'Loja Oficial Bem Instalado',
    description:
      'A loja oficial Bem Instalado Home Decor reúne papéis de parede para vários estilos, com operação em Florianópolis e atendimento para todo o Brasil.',
    url: MARKETPLACE_URL,
    cta_label: MARKETPLACE_CTA_LABEL,
    whatsapp_url: MARKETPLACE_WHATSAPP_URL,
    contact_phone: MARKETPLACE_CONTACT_PHONE,
    contact_email: MARKETPLACE_CONTACT_EMAIL,
    highlights: ['Papel de parede', 'Infantil e ambientes', 'Pagamento via Pix'],
  };
}

function normalizeExternalUrl(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

async function getRecommendedStores(limit = 12, activeOnly = true) {
  const values = [];
  let whereClause = '';
  let limitClause = '';

  if (activeOnly) {
    whereClause = 'WHERE is_active = TRUE';
  }

  if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
    values.push(Math.min(Math.trunc(Number(limit)), 30));
    limitClause = `LIMIT $${values.length}`;
  }

  const { rows } = await pool.query(
    `
      SELECT
        id,
        name,
        description,
        image_url,
        link_url,
        cta_label,
        is_active,
        sort_order
      FROM recommended_stores
      ${whereClause}
      ORDER BY sort_order ASC, updated_at DESC, created_at DESC
      ${limitClause}
    `,
    values
  );

  return rows.map((store) => ({
    ...store,
    link_url: normalizeExternalUrl(store.link_url),
  }));
}

function maskDocument(value) {
  const normalized = String(value || '').replace(/\D/g, '');

  if (!normalized) {
    return '';
  }

  if (normalized.length <= 4) {
    return normalized;
  }

  return `***${normalized.slice(-4)}`;
}

function buildSafetySummary(installer) {
  return {
    document_type: installer.document_type || '',
    document_masked: maskDocument(installer.document_id),
    has_certificate: Boolean(installer.certificate_file),
    certificate_name: installer.certificate_name || '',
    certificate_verified: Boolean(installer.certification_verified),
    accepts_service_contract: Boolean(installer.accepts_service_contract),
    provides_warranty: Boolean(installer.provides_warranty),
    warranty_days: Number(installer.warranty_days || 0),
    emergency_contact: installer.emergency_contact || '',
    emergency_phone: installer.emergency_phone || '',
    safety_notes: installer.safety_notes || '',
  };
}

function normalizeGalleryList(value, limit = 12) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeGalleryList(parsed, limit);
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function normalizeReviewerName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getClientIp(req) {
  const rawIp = String(req.ip || req.socket?.remoteAddress || '').trim();
  return rawIp.replace(/^::ffff:/, '').slice(0, 64);
}

function buildReviewerFingerprint(req, installerId) {
  const ip = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);
  return crypto.createHash('sha256').update(`${installerId}|${ip}|${userAgent}`).digest('hex');
}

function normalizeSlotTime(value) {
  return String(value || '').slice(0, 5);
}

function serializePublicSlot(row) {
  const slotDate = row.slot_date instanceof Date
    ? row.slot_date.toISOString().slice(0, 10)
    : String(row.slot_date || '').slice(0, 10);

  return {
    id: row.id,
    slot_date: slotDate,
    start_time: normalizeSlotTime(row.start_time),
    end_time: normalizeSlotTime(row.end_time),
  };
}

async function getTopInstallers(limit = 5) {
  const { rows } = await pool.query(
    `
      SELECT
        *
      FROM (
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
      ) ranked
      ORDER BY ranking_position ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

exports.getInstallers = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const city = (req.query.city || '').trim();
    const state = (req.query.state || '').trim();
    const searchTerm = `%${search}%`;
    const cityTerm = `%${city}%`;
    const stateTerm = `%${state}%`;

    const installerResult = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name,
          u.logo,
          u.installer_photo,
          COALESCE(u.installation_gallery, '[]'::jsonb) AS installation_gallery,
          u.certificate_file,
          u.certificate_name,
          u.certification_verified,
          u.featured_installer,
          u.city,
          u.state,
          u.service_region,
          u.bio,
          u.installation_method,
          u.service_hours,
          u.phone,
          COALESCE(u.installation_days, ARRAY[]::TEXT[]) AS installation_days,
          u.base_service_cost,
          u.travel_fee,
          u.years_experience,
          u.wallpaper_store_recommended,
          u.document_type,
          u.document_id,
          u.emergency_contact,
          u.emergency_phone,
          u.safety_notes,
          u.accepts_service_contract,
          u.provides_warranty,
          u.warranty_days,
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
          )::int AS trusted_sales_score
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
          AND ($1 = '%%' OR (
            COALESCE(u.business_name, '') ILIKE $1
            OR COALESCE(u.name, '') ILIKE $1
            OR COALESCE(u.city, '') ILIKE $1
            OR COALESCE(u.state, '') ILIKE $1
            OR COALESCE(u.service_region, '') ILIKE $1
            OR COALESCE(u.installation_method, '') ILIKE $1
          ))
          AND ($2 = '%%' OR COALESCE(u.city, '') ILIKE $2 OR COALESCE(u.service_region, '') ILIKE $2)
          AND ($3 = '%%' OR COALESCE(u.state, '') ILIKE $3)
        ORDER BY
          COALESCE(u.featured_installer, FALSE) DESC,
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
        LIMIT 24
      `,
      [searchTerm, cityTerm, stateTerm]
    );

    const statsResult = await pool.query(
      `
        WITH filtered_installers AS (
          SELECT
            u.id,
            NULLIF(TRIM(u.city), '') AS city,
            NULLIF(TRIM(u.state), '') AS state,
            COALESCE(u.featured_installer, false) AS featured_installer
          FROM users u
          WHERE COALESCE(u.public_profile, true) = true
            AND ($1 = '%%' OR (
              COALESCE(u.business_name, '') ILIKE $1
              OR COALESCE(u.name, '') ILIKE $1
              OR COALESCE(u.city, '') ILIKE $1
              OR COALESCE(u.state, '') ILIKE $1
              OR COALESCE(u.service_region, '') ILIKE $1
              OR COALESCE(u.installation_method, '') ILIKE $1
            ))
            AND ($2 = '%%' OR COALESCE(u.city, '') ILIKE $2 OR COALESCE(u.service_region, '') ILIKE $2)
            AND ($3 = '%%' OR COALESCE(u.state, '') ILIKE $3)
        )
        SELECT
          COUNT(*)::int AS installers_count,
          COUNT(DISTINCT CONCAT_WS(' - ', city, state))::int AS cities_count,
          COUNT(*) FILTER (WHERE featured_installer)::int AS featured_count,
          COALESCE((
            SELECT COUNT(*)::int
            FROM installer_reviews ir
            JOIN filtered_installers fi ON fi.id = ir.installer_id
          ), 0)::int AS reviews_count,
          COALESCE((
            SELECT AVG(ir.rating)::numeric(10, 2)
            FROM installer_reviews ir
            JOIN filtered_installers fi ON fi.id = ir.installer_id
          ), 0)::numeric(10, 2) AS average_rating
        FROM filtered_installers
      `,
      [searchTerm, cityTerm, stateTerm]
    );

    const installers = installerResult.rows;
    const stats = statsResult.rows[0] || {};
    const installerIds = installers.map((installer) => installer.id);
    let busyDatesByInstaller = new Map();
    let availabilitySlotsByInstaller = new Map();

    if (installerIds.length > 0) {
      const [scheduleResult, availabilityResult] = await Promise.all([
        pool.query(
          `
            SELECT user_id, ARRAY_REMOVE(ARRAY_AGG(date ORDER BY date ASC), NULL) AS busy_dates
            FROM schedules
            WHERE user_id = ANY($1::INT[])
              AND status <> 'canceled'
              AND date >= CURRENT_DATE
              AND date < CURRENT_DATE + INTERVAL '35 days'
            GROUP BY user_id
          `,
          [installerIds]
        ),
        pool.query(
          `
            SELECT id, user_id, slot_date, start_time::text AS start_time, end_time::text AS end_time
            FROM installer_availability_slots
            WHERE user_id = ANY($1::INT[])
              AND is_active = TRUE
              AND slot_date >= CURRENT_DATE
              AND slot_date < CURRENT_DATE + INTERVAL '35 days'
            ORDER BY slot_date ASC, start_time ASC
          `,
          [installerIds]
        ),
      ]);

      busyDatesByInstaller = new Map(
        scheduleResult.rows.map((row) => [row.user_id, row.busy_dates || []])
      );

      availabilitySlotsByInstaller = availabilityResult.rows.reduce((accumulator, slot) => {
        const currentSlots = accumulator.get(slot.user_id) || [];
        currentSlots.push(serializePublicSlot(slot));
        accumulator.set(slot.user_id, currentSlots);
        return accumulator;
      }, new Map());
    }

    const [ranking, recentReviewsResult, recommendedStores] = await Promise.all([
      getTopInstallers(5),
      pool.query(
        `
          SELECT
            ir.id,
            ir.installer_id,
            ir.reviewer_name,
            ir.reviewer_region,
            ir.rating,
            ir.comment,
            ir.created_at,
            COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name
          FROM installer_reviews ir
          JOIN users u ON u.id = ir.installer_id
          WHERE COALESCE(u.public_profile, true) = true
          ORDER BY ir.created_at DESC
          LIMIT 6
        `
      ),
      getRecommendedStores(12, true),
    ]);

    return res.json({
      installers: installers.map((installer) => {
        const {
          document_id: _documentId,
          document_type: _documentType,
          emergency_contact: _emergencyContact,
          emergency_phone: _emergencyPhone,
          safety_notes: _safetyNotes,
          accepts_service_contract: _acceptsContract,
          provides_warranty: _providesWarranty,
          warranty_days: _warrantyDays,
          installation_gallery: _installationGallery,
          certificate_file: _certificateFile,
          certificate_name: _certificateName,
          certification_verified: _certificationVerified,
          ...publicInstaller
        } = installer;

        const manualSlots = availabilitySlotsByInstaller.get(installer.id) || [];
        const galleryPreview = normalizeGalleryList(installer.installation_gallery, 4);
        const galleryCount = normalizeGalleryList(installer.installation_gallery, 20).length;
        const manualDates = Array.from(new Set(manualSlots.map((slot) => slot.slot_date)));
        const fallbackDates = buildAvailableDates(
          installer.installation_days,
          busyDatesByInstaller.get(installer.id) || [],
          3
        );
        const availableDates = manualDates.length
          ? manualDates.slice(0, 3).map((slotDate) => `${slotDate}T12:00:00`)
          : fallbackDates;

        return {
          ...publicInstaller,
          average_rating: Number(installer.average_rating || 0),
          safety: buildSafetySummary(installer),
          whatsapp_link: installer.phone
            ? generateWhatsAppLink(
                installer.phone,
                `Olá ${installer.display_name}, vi seu perfil na Bem Instalado e gostaria de conversar sobre uma instalação.`
              )
            : null,
          featured_installer: Boolean(installer.featured_installer),
          certificate_verified: Boolean(installer.certification_verified),
          has_certificate: Boolean(installer.certificate_file),
          installation_gallery_preview: galleryPreview,
          portfolio_count: galleryCount,
          available_dates: availableDates,
          availability_slots: manualSlots.slice(0, 6),
        };
      }),
      stats: {
        installers: Number(stats.installers_count || 0),
        cities: Number(stats.cities_count || 0),
        reviews: Number(stats.reviews_count || 0),
        featured: Number(stats.featured_count || 0),
        average_rating: Number(stats.average_rating || 0),
      },
      ranking,
      reviews: recentReviewsResult.rows,
      recommended_stores: recommendedStores,
      marketplace: buildMarketplacePayload(),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar a vitrine pública.' });
  }
};

exports.getRecommendedStores = async (_req, res) => {
  try {
    const stores = await getRecommendedStores(20, true);
    return res.json({ stores });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar lojas recomendadas.' });
  }
};

exports.reverseLocation = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }

    const region = await reverseGeocode(lat, lon, req.headers['accept-language'] || 'pt-BR');

    if (!region.city && !region.state) {
      return res.status(404).json({ error: 'Não foi possível identificar sua região.' });
    }

    return res.json(region);
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível localizar sua região agora.' });
  }
};

exports.getInstallerProfile = async (req, res) => {
  try {
    const installerId = Number(req.params.id);

    if (!installerId) {
      return res.status(400).json({ error: 'Instalador inválido.' });
    }

    const [installerResult, reviewsResult, scheduleResult, availabilityResult] = await Promise.all([
      pool.query(
        `
          SELECT
            u.id,
            u.name,
            COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name,
            u.logo,
            u.installer_photo,
            COALESCE(u.installation_gallery, '[]'::jsonb) AS installation_gallery,
            u.certificate_file,
            u.certificate_name,
            u.certification_verified,
            u.featured_installer,
            u.phone,
            u.city,
            u.state,
            u.service_region,
            u.bio,
            u.installation_method,
            u.service_hours,
            COALESCE(u.installation_days, ARRAY[]::TEXT[]) AS installation_days,
            u.base_service_cost,
            u.travel_fee,
            u.default_price_per_roll,
            u.default_removal_price,
            u.years_experience,
            u.wallpaper_store_recommended,
            u.document_type,
            u.document_id,
            u.emergency_contact,
            u.emergency_phone,
            u.safety_notes,
            u.accepts_service_contract,
            u.provides_warranty,
            u.warranty_days,
            COALESCE(reviews.average_rating, 0) AS average_rating,
            COALESCE(reviews.review_count, 0)::int AS review_count,
            COALESCE(budget_stats.approved_jobs, 0)::int AS approved_jobs,
            COALESCE(budget_stats.unique_clients_served, 0)::int AS unique_clients_served,
            COALESCE(schedule_stats.completed_jobs, 0)::int AS completed_jobs,
            COALESCE(schedule_stats.completed_unique_clients, 0)::int AS completed_unique_clients
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
          WHERE u.id = $1
            AND COALESCE(u.public_profile, true) = true
        `,
        [installerId]
      ),
      pool.query(
        `
          SELECT reviewer_name, reviewer_region, rating, comment, created_at
          FROM installer_reviews
          WHERE installer_id = $1
          ORDER BY created_at DESC
          LIMIT 12
        `,
        [installerId]
      ),
      pool.query(
        `
          SELECT ARRAY_REMOVE(ARRAY_AGG(date ORDER BY date ASC), NULL) AS busy_dates
          FROM schedules
          WHERE user_id = $1
            AND status <> 'canceled'
            AND date >= CURRENT_DATE
            AND date < CURRENT_DATE + INTERVAL '35 days'
        `,
        [installerId]
      ),
      pool.query(
        `
          SELECT id, slot_date, start_time::text AS start_time, end_time::text AS end_time
          FROM installer_availability_slots
          WHERE user_id = $1
            AND is_active = TRUE
            AND slot_date >= CURRENT_DATE
            AND slot_date < CURRENT_DATE + INTERVAL '70 days'
          ORDER BY slot_date ASC, start_time ASC
          LIMIT 120
        `,
        [installerId]
      ),
    ]);

    const installer = installerResult.rows[0];

    if (!installer) {
      return res.status(404).json({ error: 'Instalador não encontrado.' });
    }

    return res.json({
      installer: (() => {
        const {
          document_id: _documentId,
          document_type: _documentType,
          emergency_contact: _emergencyContact,
          emergency_phone: _emergencyPhone,
          safety_notes: _safetyNotes,
          accepts_service_contract: _acceptsContract,
          provides_warranty: _providesWarranty,
          warranty_days: _warrantyDays,
          ...publicInstaller
        } = installer;

        const manualSlots = availabilityResult.rows.map(serializePublicSlot);
        const manualDates = Array.from(new Set(manualSlots.map((slot) => slot.slot_date)));
        const fallbackDates = buildAvailableDates(
          installer.installation_days,
          scheduleResult.rows[0]?.busy_dates || [],
          6
        );
        const availableDates = manualDates.length
          ? manualDates.slice(0, 6).map((slotDate) => `${slotDate}T12:00:00`)
          : fallbackDates;
        const installationGallery = normalizeGalleryList(installer.installation_gallery, 20);

        return {
          ...publicInstaller,
          average_rating: Number(installer.average_rating || 0),
          installation_gallery: installationGallery,
          featured_installer: Boolean(installer.featured_installer),
          certificate_file: installer.certificate_file || '',
          certificate_name: installer.certificate_name || '',
          certificate_verified: Boolean(installer.certification_verified),
          safety: buildSafetySummary(installer),
          whatsapp_link: installer.phone
            ? generateWhatsAppLink(
                installer.phone,
                `Olá ${installer.display_name}, vi seu perfil na Bem Instalado e quero conversar sobre meu projeto.`
              )
            : null,
          available_dates: availableDates,
          availability_slots: manualSlots,
        };
      })(),
      reviews: reviewsResult.rows,
      marketplace: buildMarketplacePayload(),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar o perfil público do instalador.' });
  }
};

const legacyCreateReview = async (req, res) => {
  try {
    const installerId = Number(req.params.id);
    const reviewerName = (req.body.reviewer_name || '').trim();
    const reviewerRegion = (req.body.reviewer_region || '').trim();
    const rating = Number(req.body.rating || 0);
    const comment = (req.body.comment || '').trim();
    const normalizedName = normalizeReviewerName(reviewerName);
    const reviewerFingerprint = buildReviewerFingerprint(req, installerId);
    const reviewerIp = getClientIp(req);

    if (!installerId || !reviewerName || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Nome e nota válida são obrigatórios.' });
    }

    const installerCheck = await pool.query(
      `
        SELECT id
        FROM users
        WHERE id = $1 AND COALESCE(public_profile, true) = true
      `,
      [installerId]
    );

    if (!installerCheck.rowCount) {
      return res.status(404).json({ error: 'Instalador não encontrado.' });
    }

    const [recentSameDeviceResult, recentSameNameResult] = await Promise.all([
      pool.query(
        `
          SELECT id
          FROM installer_reviews
          WHERE installer_id = $1
            AND reviewer_fingerprint = $2
            AND created_at >= NOW() - INTERVAL '24 hours'
          LIMIT 1
        `,
        [installerId, reviewerFingerprint]
      ),
      pool.query(
        `
          SELECT id
          FROM installer_reviews
          WHERE installer_id = $1
            AND LOWER(TRIM(reviewer_name)) = $2
            AND created_at >= NOW() - INTERVAL '7 days'
          LIMIT 1
        `,
        [installerId, normalizedName]
      ),
    ]);

    if (recentSameDeviceResult.rowCount > 0) {
      return res.status(429).json({
        error: 'Você já enviou uma avaliação recente para este instalador. Tente novamente mais tarde.',
      });
    }

    if (recentSameNameResult.rowCount > 0) {
      return res.status(409).json({
        error: 'Já existe uma avaliação recente com esse nome para este instalador.',
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO installer_reviews (
          installer_id,
          reviewer_name,
          reviewer_region,
          rating,
          comment,
          reviewer_ip,
          reviewer_fingerprint
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, installer_id, reviewer_name, reviewer_region, rating, comment, created_at
      `,
      [
        installerId,
        reviewerName,
        reviewerRegion || null,
        rating,
        comment || null,
        reviewerIp || null,
        reviewerFingerprint,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao enviar a avaliação.' });
  }
};

exports.createReview = async (req, res) => {
  try {
    const installerId = Number(req.params.id);
    const reviewerUserId = Number(req.userId);
    const reviewerName = String(req.body.reviewer_name || '').trim();
    const reviewerRegion = String(req.body.reviewer_region || '').trim();
    const rating = Number(req.body.rating || 0);
    const comment = String(req.body.comment || '').trim();
    const normalizedName = normalizeReviewerName(reviewerName);
    const reviewerFingerprint = buildReviewerFingerprint(req, installerId);
    const reviewerIp = getClientIp(req);

    if (!Number.isInteger(reviewerUserId) || reviewerUserId <= 0) {
      return res.status(401).json({ error: 'Faça login para avaliar instaladores.' });
    }

    if (!installerId || !reviewerName || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Nome e nota válida são obrigatórios.' });
    }

    const installerCheck = await pool.query(
      `
        SELECT id
        FROM users
        WHERE id = $1 AND COALESCE(public_profile, true) = true
      `,
      [installerId]
    );

    if (!installerCheck.rowCount) {
      return res.status(404).json({ error: 'Instalador não encontrado.' });
    }

    if (reviewerUserId === installerId) {
      return res.status(403).json({ error: 'Você não pode avaliar o seu próprio perfil.' });
    }

    const [recentSameUserResult, recentSameIpResult, recentSameDeviceResult, recentSameNameResult] =
      await Promise.all([
        pool.query(
          `
            SELECT id
            FROM installer_reviews
            WHERE installer_id = $1
              AND reviewer_user_id = $2
            LIMIT 1
          `,
            [installerId, reviewerUserId]
          ),
        pool.query(
          `
            SELECT id
            FROM installer_reviews
            WHERE installer_id = $1
              AND reviewer_ip = $2
              AND created_at >= NOW() - INTERVAL '7 days'
            LIMIT 1
          `,
            [installerId, reviewerIp || null]
          ),
        pool.query(
          `
            SELECT id
            FROM installer_reviews
            WHERE installer_id = $1
              AND reviewer_fingerprint = $2
              AND created_at >= NOW() - INTERVAL '24 hours'
            LIMIT 1
          `,
          [installerId, reviewerFingerprint]
        ),
        pool.query(
          `
            SELECT id
            FROM installer_reviews
            WHERE installer_id = $1
              AND LOWER(TRIM(reviewer_name)) = $2
              AND created_at >= NOW() - INTERVAL '7 days'
            LIMIT 1
          `,
          [installerId, normalizedName]
        ),
      ]);

    if (recentSameUserResult.rowCount > 0) {
      return res.status(409).json({
        error: 'Esta conta já enviou uma avaliação para este instalador.',
      });
    }

    if (reviewerIp && recentSameIpResult.rowCount > 0) {
      return res.status(429).json({
        error: 'Este IP já enviou uma avaliação recente para este instalador. Tente novamente mais tarde.',
      });
    }

    if (recentSameDeviceResult.rowCount > 0) {
      return res.status(429).json({
        error: 'Você já enviou uma avaliação recente para este instalador. Tente novamente mais tarde.',
      });
    }

    if (recentSameNameResult.rowCount > 0) {
      return res.status(409).json({
        error: 'Já existe uma avaliação recente com esse nome para este instalador.',
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO installer_reviews (
          installer_id,
          reviewer_user_id,
          reviewer_name,
          reviewer_region,
          rating,
          comment,
          reviewer_ip,
          reviewer_fingerprint
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, installer_id, reviewer_name, reviewer_region, rating, comment, created_at
      `,
      [
        installerId,
        reviewerUserId,
        reviewerName,
        reviewerRegion || null,
        rating,
        comment || null,
        reviewerIp || null,
        reviewerFingerprint,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma avaliação registrada por esta conta.' });
    }

    return res.status(500).json({ error: 'Erro ao enviar a avaliação.' });
  }
};
