const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const pool = require('./config/database');
const { jwtSecret } = require('./config/auth');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const supportRoutes = require('./routes/supportRoutes');

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedCorsOrigins = configuredOrigins.length > 0 ? configuredOrigins : isProduction ? [] : defaultDevOrigins;
const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);

function isPrivateIPv4(hostname) {
  if (!hostname || !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const parts = hostname.split('.').map((item) => Number(item));

  if (parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  return false;
}

function isTrustedDevOrigin(origin) {
  try {
    const parsedOrigin = new URL(origin);
    return localHostnames.has(parsedOrigin.hostname) || isPrivateIPv4(parsedOrigin.hostname);
  } catch (_error) {
    return false;
  }
}

function validateCorsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  if (allowedCorsOrigins.includes(origin)) {
    return callback(null, true);
  }

  if (!isProduction && isTrustedDevOrigin(origin)) {
    return callback(null, true);
  }

  if (allowedCorsOrigins.length === 0) {
    return callback(new Error('CORS bloqueado: configure FRONTEND_URL com os domínios permitidos.'));
  }

  return callback(new Error('Origem não permitida pelo CORS.'));
}

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: validateCorsOrigin,
  })
);
app.use(express.json({ limit: '10mb' }));

const io = new Server(httpServer, {
  cors: {
    origin: validateCorsOrigin,
  },
});

app.set('io', io);

function getSocketToken(socket) {
  const authHeader = socket.handshake?.headers?.authorization;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const authToken = socket.handshake?.auth?.token || socket.handshake?.query?.token;

  if (!authToken) {
    return null;
  }

  return String(authToken).replace(/^Bearer\s+/i, '').trim();
}

io.use(async (socket, next) => {
  try {
    const token = getSocketToken(socket);

    if (!token) {
      return next(new Error('Token ausente.'));
    }

    const decoded = jwt.verify(token, jwtSecret);
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          business_name,
          email,
          is_admin
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [decoded.id]
    );
    const user = result.rows[0];

    if (!user) {
      return next(new Error('Usuário não encontrado.'));
    }

    socket.user = {
      id: user.id,
      name: user.business_name || user.name,
      email: user.email,
      is_admin: Boolean(user.is_admin),
    };

    return next();
  } catch (_error) {
    return next(new Error('Token inválido.'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;

  socket.join(`user:${user.id}`);

  if (user.is_admin) {
    socket.join('support:admins');
  } else {
    pool
      .query(
        `
          SELECT id
          FROM support_conversations
          WHERE installer_id = $1
          LIMIT 1
        `,
        [user.id]
      )
      .then((result) => {
        const conversation = result.rows[0];
        if (conversation) {
          socket.join(`support:${conversation.id}`);
        }
      })
      .catch(() => null);
  }

  socket.on('support:join', async (payload = {}, callback) => {
    const done = typeof callback === 'function' ? callback : () => {};
    const conversationId = Number(payload.conversationId);

    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      done({ ok: false, error: 'Conversa inválida.' });
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT installer_id
          FROM support_conversations
          WHERE id = $1
          LIMIT 1
        `,
        [conversationId]
      );

      const conversation = result.rows[0];

      if (!conversation) {
        done({ ok: false, error: 'Conversa não encontrada.' });
        return;
      }

      if (!user.is_admin && conversation.installer_id !== user.id) {
        done({ ok: false, error: 'Acesso negado para esta conversa.' });
        return;
      }

      socket.join(`support:${conversationId}`);
      done({ ok: true, conversationId });
    } catch (_error) {
      done({ ok: false, error: 'Falha ao entrar na conversa.' });
    }
  });

  socket.on('support:leave', (payload = {}, callback) => {
    const done = typeof callback === 'function' ? callback : () => {};
    const conversationId = Number(payload.conversationId);

    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      done({ ok: false, error: 'Conversa inválida.' });
      return;
    }

    socket.leave(`support:${conversationId}`);
    done({ ok: true, conversationId });
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bem-instalado-backend',
    date: new Date().toISOString(),
    mode: isProduction ? 'production' : 'development',
  });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);

if (isProduction) {
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');

  if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }

      return res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  }
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

async function ensureRuntimeSchema() {
  const statements = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS installer_photo TEXT',
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS installation_gallery JSONB NOT NULL DEFAULT '[]'::jsonb",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_file TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_name VARCHAR(180)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS certification_verified BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_installer BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type VARCHAR(20)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS document_id VARCHAR(60)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(140)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(30)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_notes TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_service_contract BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS provides_warranty BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS warranty_days INTEGER NOT NULL DEFAULT 90',
    "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'roll'",
    'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS price_per_roll NUMERIC(10, 2) DEFAULT 0',
    'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS price_per_square_meter NUMERIC(10, 2) DEFAULT 0',
    'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS installment_enabled BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS installments_count INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE environments ADD COLUMN IF NOT EXISTS price_per_square_meter NUMERIC(10, 2) DEFAULT 0',
    'ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_included BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_price NUMERIC(10, 2) DEFAULT 0',
    'ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_total NUMERIC(10, 2) DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS street VARCHAR(160)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS house_number VARCHAR(30)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(120)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS city VARCHAR(120)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS state VARCHAR(80)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)',
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_reference TEXT',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_street VARCHAR(160)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_number VARCHAR(30)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_neighborhood VARCHAR(120)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_city VARCHAR(120)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_state VARCHAR(80)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_zip_code VARCHAR(20)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_reference TEXT',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_full_address TEXT',
    'ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL',
    'ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_ip VARCHAR(64)',
    'ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_fingerprint VARCHAR(80)',
    `
      CREATE TABLE IF NOT EXISTS support_conversations (
        id SERIAL PRIMARY KEY,
        installer_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        is_from_admin BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS support_ideas (
        id SERIAL PRIMARY KEY,
        installer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(40) NOT NULL DEFAULT 'feature',
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        admin_note TEXT,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS recommended_stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        description TEXT,
        image_url TEXT,
        link_url TEXT,
        cta_label VARCHAR(80) NOT NULL DEFAULT 'Visitar loja',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS support_conversations_last_message_idx
      ON support_conversations (last_message_at DESC, updated_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS support_messages_conversation_idx
      ON support_messages (conversation_id, created_at ASC)
    `,
    `
      CREATE INDEX IF NOT EXISTS support_messages_unread_idx
      ON support_messages (conversation_id, is_from_admin, read_at)
    `,
    `
      CREATE INDEX IF NOT EXISTS users_featured_installer_idx
      ON users (featured_installer, certification_verified, public_profile)
    `,
    `
      CREATE INDEX IF NOT EXISTS support_ideas_installer_idx
      ON support_ideas (installer_id, created_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS support_ideas_status_idx
      ON support_ideas (status, created_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS recommended_stores_active_order_idx
      ON recommended_stores (is_active, sort_order ASC, created_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS installer_reviews_fingerprint_idx
      ON installer_reviews (installer_id, reviewer_fingerprint, created_at DESC)
      WHERE reviewer_fingerprint IS NOT NULL
    `,
    `
      CREATE INDEX IF NOT EXISTS installer_reviews_ip_idx
      ON installer_reviews (installer_id, reviewer_ip, created_at DESC)
      WHERE reviewer_ip IS NOT NULL
    `,
    `
      CREATE INDEX IF NOT EXISTS installer_reviews_user_idx
      ON installer_reviews (installer_id, reviewer_user_id, created_at DESC)
      WHERE reviewer_user_id IS NOT NULL
    `,
    `
      DELETE FROM installer_reviews a
      USING installer_reviews b
      WHERE a.id < b.id
        AND a.installer_id = b.installer_id
        AND a.reviewer_user_id = b.reviewer_user_id
        AND a.reviewer_user_id IS NOT NULL
    `,
    `
      DELETE FROM installer_reviews a
      USING installer_reviews b
      WHERE a.id < b.id
        AND a.installer_id = b.installer_id
        AND a.reviewer_fingerprint = b.reviewer_fingerprint
        AND a.reviewer_fingerprint IS NOT NULL
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS installer_reviews_unique_user_idx
      ON installer_reviews (installer_id, reviewer_user_id)
      WHERE reviewer_user_id IS NOT NULL
    `,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS installer_reviews_unique_fingerprint_idx
      ON installer_reviews (installer_id, reviewer_fingerprint)
      WHERE reviewer_fingerprint IS NOT NULL
    `,
    `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
      ON password_reset_tokens (user_id, expires_at DESC, used_at)
    `,
    `
      CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(40) NOT NULL,
        event_id VARCHAR(160) NOT NULL,
        event_type VARCHAR(60),
        provider_payment_id VARCHAR(120),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider, event_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80),
        entity_id VARCHAR(100),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(64),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS payment_webhook_events_provider_idx
      ON payment_webhook_events (provider, provider_payment_id, created_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS audit_logs_action_idx
      ON audit_logs (action, created_at DESC)
    `,
    `
      CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
      ON audit_logs (actor_user_id, created_at DESC)
    `,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function startServer() {
  try {
    await ensureRuntimeSchema();
  } catch (error) {
    console.error('Falha ao validar schema da aplicação. O backend não será iniciado.');
    console.error(error);
    process.exit(1);
    return;
  }

  const port = Number(process.env.PORT || 5000);
  httpServer.listen(port, () => {
    console.log(`Bem Instalado backend rodando na porta ${port}`);
  });
}

startServer();
