const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');
const { generateSecret, verifyToken, generateQrCode } = require('../utils/totp');
const { logAudit } = require('../utils/auditLog');

const REGISTER_PLAN_PRICE = Number(process.env.SUBSCRIPTION_PRICE || 40);
const PASSWORD_RESET_EXPIRATION_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRATION_MINUTES || 30);
const PASSWORD_RESET_EXPOSE_TOKEN = process.env.PASSWORD_RESET_EXPOSE_TOKEN === 'true';

function signToken(id) {
  return jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiresIn });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    business_name: user.business_name,
    logo: user.logo,
    city: user.city,
    state: user.state,
    service_region: user.service_region,
    public_profile: user.public_profile,
    installation_days: user.installation_days || [],
    default_price_per_roll: user.default_price_per_roll,
    default_removal_price: user.default_removal_price,
    is_admin: Boolean(user.is_admin),
    two_factor_enabled: Boolean(user.two_factor_enabled),
  };
}

function buildPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, business_name } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);

    if (existingUser.rowCount > 0) {
      await logAudit({
        actorUserId: null,
        action: 'auth.register_denied_duplicate_email',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });

      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `
        INSERT INTO users (name, email, password, phone, business_name, is_admin)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        RETURNING
          id,
          name,
          email,
          phone,
          business_name,
          logo,
          city,
          state,
          service_region,
          public_profile,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          two_factor_enabled
      `,
      [name, normalizedEmail, passwordHash, phone || null, business_name || null]
    );

    const user = rows[0];

    await pool.query(
      `
        INSERT INTO subscriptions (user_id, plan, status)
        VALUES ($1, 'monthly', 'inactive')
      `,
      [user.id]
    );

    await logAudit({
      actorUserId: user.id,
      action: 'auth.register_success',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        isAdmin: false,
      },
      req,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      token: signToken(user.id),
      onboarding: {
        subscription_price: REGISTER_PLAN_PRICE,
        currency: 'BRL',
        period: 'mensal',
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    const user = rows[0];

    if (!user) {
      await logAudit({
        actorUserId: null,
        action: 'auth.login_failed_user_not_found',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const validPassword = await bcrypt.compare(password || '', user.password);

    if (!validPassword) {
      await logAudit({
        actorUserId: user.id,
        action: 'auth.login_failed_invalid_password',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email },
        req,
      });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        await logAudit({
          actorUserId: user.id,
          action: 'auth.login_requires_2fa',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email },
          req,
        });
        return res.status(401).json({ error: 'Código 2FA necessário.', twoFactorRequired: true });
      }

      if (!verifyToken(user.two_factor_secret, twoFactorToken)) {
        await logAudit({
          actorUserId: user.id,
          action: 'auth.login_failed_invalid_2fa',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email },
          req,
        });
        return res.status(401).json({ error: 'Código 2FA inválido.' });
      }
    }

    await logAudit({
      actorUserId: user.id,
      action: 'auth.login_success',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
      req,
    });

    return res.json({
      user: sanitizeUser(user),
      token: signToken(user.id),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

exports.setup2FA = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const secret = generateSecret();
    const qrCode = await generateQrCode(secret.base32, user.email);
    return res.json({ secret: secret.base32, qrCode });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao configurar 2FA.' });
  }
};

exports.enable2FA = async (req, res) => {
  try {
    const { secret, token } = req.body;

    if (!secret || !token || !verifyToken(secret, token)) {
      return res.status(400).json({ error: 'Dados de 2FA inválidos.' });
    }

    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = $1, two_factor_enabled = true, updated_at = NOW()
        WHERE id = $2
      `,
      [secret, req.userId]
    );

    await logAudit({
      actorUserId: req.userId,
      action: 'auth.2fa_enabled',
      entityType: 'user',
      entityId: req.userId,
      req,
    });

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = NULL, two_factor_enabled = false, updated_at = NOW()
        WHERE id = $1
      `,
      [req.userId]
    );

    await logAudit({
      actorUserId: req.userId,
      action: 'auth.2fa_disabled',
      entityType: 'user',
      entityId: req.userId,
      req,
    });

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao desativar 2FA.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const userResult = await pool.query(
      `
        SELECT id, email
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    // Resposta genérica para não vazar existência de conta.
    const genericResponse = {
      success: true,
      message: 'Se o e-mail existir, você receberá instruções para redefinir a senha.',
    };

    if (!user) {
      await logAudit({
        actorUserId: null,
        action: 'auth.password_reset_requested_unknown_email',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });

      return res.json(genericResponse);
    }

    const { token, tokenHash } = buildPasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000);

    await pool.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL
      `,
      [user.id]
    );

    await pool.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );

    await logAudit({
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
      req,
    });

    if (process.env.NODE_ENV !== 'production' || PASSWORD_RESET_EXPOSE_TOKEN) {
      return res.json({
        ...genericResponse,
        reset_token: token,
        reset_expires_at: expiresAt.toISOString(),
      });
    }

    return res.json(genericResponse);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao iniciar recuperação de senha.' });
  }
};

exports.resetPassword = async (req, res) => {
  const db = await pool.connect();
  try {
    const token = String(req.body?.token || '').trim();
    const nextPassword = String(req.body?.password || '');

    if (!token || !nextPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    if (nextPassword.length < 8) {
      return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetTokenResult = await pool.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );
    const resetTokenRow = resetTokenResult.rows[0];

    if (!resetTokenRow) {
      return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);

    await db.query('BEGIN');
    await db.query(
      `
        UPDATE users
        SET password = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, resetTokenRow.user_id]
    );
    await db.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = $1
      `,
      [resetTokenRow.id]
    );
    await db.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [resetTokenRow.user_id]
    );
    await db.query('COMMIT');

    await logAudit({
      actorUserId: resetTokenRow.user_id,
      action: 'auth.password_reset_success',
      entityType: 'user',
      entityId: resetTokenRow.user_id,
      req,
    });

    return res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (_error) {
    await db.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  } finally {
    db.release();
  }
};
