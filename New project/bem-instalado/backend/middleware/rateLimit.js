const buckets = new Map();
let lastCleanupAt = 0;

function getClientIp(req) {
  const rawIp = String(req.ip || req.socket?.remoteAddress || '').trim();
  const normalized = rawIp.replace(/^::ffff:/, '');
  return normalized || 'unknown';
}

function cleanupExpiredEntries(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function defaultKeyGenerator(req) {
  return getClientIp(req);
}

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 60,
  keyGenerator = defaultKeyGenerator,
  message = 'Muitas tentativas. Aguarde alguns segundos e tente novamente.',
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || 'unknown');
    const scopedKey = `${req.method}:${req.baseUrl || ''}:${req.path || ''}:${key}`;
    const current = buckets.get(scopedKey);

    if (!current || current.resetAt <= now) {
      buckets.set(scopedKey, { count: 1, resetAt: now + windowMs });
    } else {
      current.count += 1;
      buckets.set(scopedKey, current);
    }

    if (now - lastCleanupAt > 60 * 1000) {
      cleanupExpiredEntries(now);
      lastCleanupAt = now;
    }

    const bucket = buckets.get(scopedKey);
    const remaining = Math.max(max - bucket.count, 0);
    const retryAfterSeconds = Math.ceil(Math.max(bucket.resetAt - now, 0) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: message,
        retry_after_seconds: retryAfterSeconds,
      });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  getClientIp,
};
