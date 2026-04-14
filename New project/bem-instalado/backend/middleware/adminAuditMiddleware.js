const { logAudit } = require('../utils/auditLog');

function buildActionFromRequest(req) {
  const method = String(req.method || 'UNKNOWN').toLowerCase();
  const path = String(req.path || '/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '');

  const normalizedPath = path || 'root';
  return `admin.${method}.${normalizedPath.replace(/\//g, '.')}`;
}

module.exports = (req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 500) {
      return;
    }

    const bodyKeys = req.body && typeof req.body === 'object'
      ? Object.keys(req.body).slice(0, 20)
      : [];

    logAudit({
      actorUserId: req.userId || null,
      action: buildActionFromRequest(req),
      entityType: req.params?.id ? 'resource' : 'admin',
      entityId: req.params?.id || null,
      metadata: {
        statusCode: res.statusCode,
        method: req.method,
        path: req.path,
        bodyKeys,
      },
      req,
    });
  });

  return next();
};

