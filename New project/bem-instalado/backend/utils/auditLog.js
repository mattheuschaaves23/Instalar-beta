const pool = require('../config/database');
const { getClientIp } = require('../middleware/rateLimit');

function sanitizeMetadata(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  return { value: String(value) };
}

async function logAudit({
  actorUserId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = {},
  req = null,
}) {
  if (!action) {
    return;
  }

  const ipAddress = req ? getClientIp(req).slice(0, 64) : null;
  const userAgent = req ? String(req.headers['user-agent'] || '').slice(0, 255) : null;

  try {
    await pool.query(
      `
        INSERT INTO audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        actorUserId,
        action,
        entityType,
        entityId ? String(entityId).slice(0, 100) : null,
        JSON.stringify(sanitizeMetadata(metadata)),
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    console.error('Falha ao registrar audit log.');
    console.error(error);
  }
}

module.exports = {
  logAudit,
};

