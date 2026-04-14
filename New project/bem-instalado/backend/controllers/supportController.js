const pool = require('../config/database');

const IDEA_CATEGORIES = new Set([
  'feature',
  'ux',
  'performance',
  'payments',
  'security',
  'automation',
  'other',
]);

const IDEA_STATUSES = new Set(['new', 'reviewing', 'planned', 'done', 'rejected']);

function parsePositiveInt(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseLimit(value, fallback = 40, max = 120) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function normalizeBody(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 2500);
}

function normalizeIdeaTitle(value) {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.length < 8) {
    return null;
  }

  return normalized.slice(0, 160);
}

function normalizeIdeaDescription(value) {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.length < 20) {
    return null;
  }

  return normalized.slice(0, 6000);
}

function normalizeIdeaCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!IDEA_CATEGORIES.has(normalized)) {
    return 'other';
  }

  return normalized;
}

function normalizeIdeaStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!IDEA_STATUSES.has(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeOptionalNote(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 2500);
}

function serializeMessage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_is_admin: Boolean(row.sender_is_admin),
    body: row.body,
    is_from_admin: Boolean(row.is_from_admin),
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

function serializeConversation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    installer_id: row.installer_id,
    installer_name: row.installer_name,
    installer_email: row.installer_email,
    installer_phone: row.installer_phone,
    status: row.status,
    last_message: row.last_message || '',
    last_message_at: row.last_message_at || row.updated_at || row.created_at,
    unread_count: Number(row.unread_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeIdea(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    installer_id: row.installer_id,
    installer_name: row.installer_name,
    installer_email: row.installer_email,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    admin_note: row.admin_note,
    reviewed_by: row.reviewed_by,
    reviewed_by_name: row.reviewed_by_name,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getAuthUser(userId, db = pool) {
  const result = await db.query(
    `
      SELECT
        id,
        name,
        email,
        phone,
        business_name,
        is_admin
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function ensureInstallerConversation(installerId, db = pool) {
  const existing = await db.query(
    `
      SELECT
        c.id,
        c.installer_id,
        c.status,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
        u.email AS installer_email,
        u.phone AS installer_phone
      FROM support_conversations c
      JOIN users u ON u.id = c.installer_id
      WHERE c.installer_id = $1
      LIMIT 1
    `,
    [installerId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await db.query(
    `
      INSERT INTO support_conversations (installer_id, status, last_message_at)
      VALUES ($1, 'open', NOW())
      ON CONFLICT (installer_id) DO UPDATE
      SET updated_at = support_conversations.updated_at
      RETURNING id, installer_id, status, last_message_at, created_at, updated_at
    `,
    [installerId]
  );

  const conversation = created.rows[0];
  const installer = await getAuthUser(installerId, db);

  return {
    ...conversation,
    installer_name: installer?.business_name || installer?.name || '-',
    installer_email: installer?.email || '-',
    installer_phone: installer?.phone || '',
  };
}

async function getConversationById(conversationId, db = pool) {
  const result = await db.query(
    `
      SELECT
        c.id,
        c.installer_id,
        c.status,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
        u.email AS installer_email,
        u.phone AS installer_phone
      FROM support_conversations c
      JOIN users u ON u.id = c.installer_id
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversationId]
  );

  return result.rows[0] || null;
}

async function getConversationSummary(conversationId, db = pool) {
  const result = await db.query(
    `
      SELECT
        c.id,
        c.installer_id,
        c.status,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
        u.email AS installer_email,
        u.phone AS installer_phone,
        COALESCE(last_msg.body, '') AS last_message,
        COALESCE(unread.unread_count, 0)::int AS unread_count
      FROM support_conversations c
      JOIN users u ON u.id = c.installer_id
      LEFT JOIN LATERAL (
        SELECT m.body
        FROM support_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) last_msg ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM support_messages m
        WHERE
          m.conversation_id = c.id
          AND m.is_from_admin = false
          AND m.read_at IS NULL
      ) unread ON TRUE
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversationId]
  );

  return result.rows[0] || null;
}

async function getConversationMessages(conversationId, limit = 120, db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,
          m.body,
          m.is_from_admin,
          m.read_at,
          m.created_at,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS sender_name,
          u.is_admin AS sender_is_admin
        FROM support_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $2
      ) recent
      ORDER BY recent.created_at ASC, recent.id ASC
    `,
    [conversationId, limit]
  );

  return result.rows.map(serializeMessage);
}

async function getIdeaById(ideaId, db = pool) {
  const result = await db.query(
    `
      SELECT
        i.id,
        i.installer_id,
        i.title,
        i.description,
        i.category,
        i.status,
        i.admin_note,
        i.reviewed_by,
        i.reviewed_at,
        i.created_at,
        i.updated_at,
        COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
        u.email AS installer_email,
        COALESCE(NULLIF(reviewer.business_name, ''), reviewer.name) AS reviewed_by_name
      FROM support_ideas i
      JOIN users u ON u.id = i.installer_id
      LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
      WHERE i.id = $1
      LIMIT 1
    `,
    [ideaId]
  );

  return result.rows[0] || null;
}

async function emitConversationUpdate(req, summary, message) {
  const io = req.app.get('io');

  if (!io || !summary) {
    return;
  }

  const payload = {
    conversation: serializeConversation(summary),
    message: serializeMessage(message),
  };

  io.to(`support:${summary.id}`).emit('support:new_message', payload);
  io.to(`user:${summary.installer_id}`).emit('support:new_message', payload);
  io.to('support:admins').emit('support:new_message', payload);
}

async function emitConversationState(req, summary) {
  const io = req.app.get('io');

  if (!io || !summary) {
    return;
  }

  const payload = {
    conversation: serializeConversation(summary),
  };

  io.to(`support:${summary.id}`).emit('support:conversation_updated', payload);
  io.to(`user:${summary.installer_id}`).emit('support:conversation_updated', payload);
  io.to('support:admins').emit('support:conversation_updated', payload);
}

async function emitIdeaUpdate(req, idea, eventName = 'support:idea_updated') {
  const io = req.app.get('io');

  if (!io || !idea) {
    return;
  }

  const payload = { idea: serializeIdea(idea) };

  io.to(`user:${idea.installer_id}`).emit(eventName, payload);
  io.to('support:admins').emit(eventName, payload);
}

exports.getMyConversation = async (req, res) => {
  try {
    const authUser = await getAuthUser(req.userId, db);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (authUser.is_admin) {
      return res.status(403).json({ error: 'Use os endpoints de administrador para suporte.' });
    }

    const conversation = await ensureInstallerConversation(authUser.id);
    const summary = await getConversationSummary(conversation.id);
    const messages = await getConversationMessages(conversation.id, 160);

    return res.json({
      conversation: serializeConversation(summary || conversation),
      messages,
      current_user: {
        id: authUser.id,
        name: authUser.business_name || authUser.name,
        is_admin: false,
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar conversa de suporte.' });
  }
};

exports.getAdminConversations = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 60, 200);

    const result = await pool.query(
      `
        SELECT
          c.id,
          c.installer_id,
          c.status,
          c.last_message_at,
          c.created_at,
          c.updated_at,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
          u.email AS installer_email,
          u.phone AS installer_phone,
          COALESCE(last_msg.body, '') AS last_message,
          COALESCE(unread.unread_count, 0)::int AS unread_count
        FROM support_conversations c
        JOIN users u ON u.id = c.installer_id
        LEFT JOIN LATERAL (
          SELECT m.body
          FROM support_messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) last_msg ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS unread_count
          FROM support_messages m
          WHERE
            m.conversation_id = c.id
            AND m.is_from_admin = false
            AND m.read_at IS NULL
        ) unread ON TRUE
        ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
        LIMIT $1
      `,
      [limit]
    );

    return res.json({
      conversations: result.rows.map(serializeConversation),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar conversas de suporte.' });
  }
};

exports.getAdminConversationMessages = async (req, res) => {
  try {
    const conversationId = parsePositiveInt(req.params.conversationId);
    const limit = parseLimit(req.query.limit, 160, 300);

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversa inválida.' });
    }

    const conversation = await getConversationSummary(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    const messages = await getConversationMessages(conversationId, limit);

    return res.json({
      conversation: serializeConversation(conversation),
      messages,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar mensagens da conversa.' });
  }
};

exports.sendMessage = async (req, res) => {
  const db = await pool.connect();

  try {
    const authUser = await getAuthUser(req.userId);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const body = normalizeBody(req.body.body);

    if (!body) {
      return res.status(400).json({ error: 'Digite uma mensagem antes de enviar.' });
    }

    await db.query('BEGIN');

    let conversation = null;

    if (authUser.is_admin) {
      const conversationId = parsePositiveInt(req.body.conversation_id);

      if (!conversationId) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Admin deve informar a conversa para responder.' });
      }

      const foundConversation = await getConversationById(conversationId, db);

      if (!foundConversation) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversa não encontrada.' });
      }

      conversation = foundConversation;
    } else {
      conversation = await ensureInstallerConversation(authUser.id, db);
    }

    const insertedMessage = await db.query(
      `
        INSERT INTO support_messages (conversation_id, sender_id, body, is_from_admin)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, sender_id, body, is_from_admin, read_at, created_at
      `,
      [conversation.id, authUser.id, body, Boolean(authUser.is_admin)]
    );

    await db.query(
      `
        UPDATE support_conversations
        SET
          last_message_at = NOW(),
          status = 'open',
          updated_at = NOW()
        WHERE id = $1
      `,
      [conversation.id]
    );

    await db.query('COMMIT');

    const messageRow = insertedMessage.rows[0];
    const fullMessage = {
      ...messageRow,
      sender_name: authUser.business_name || authUser.name,
      sender_is_admin: Boolean(authUser.is_admin),
    };
    const summary = await getConversationSummary(conversation.id);

    await emitConversationUpdate(req, summary, fullMessage);

    return res.status(201).json({
      conversation: serializeConversation(summary),
      message: serializeMessage(fullMessage),
    });
  } catch (_error) {
    await db.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Erro ao enviar mensagem de suporte.' });
  } finally {
    db.release();
  }
};

exports.markMyConversationAsRead = async (req, res) => {
  try {
    const authUser = await getAuthUser(req.userId);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (authUser.is_admin) {
      return res.status(403).json({ error: 'Use o endpoint administrativo para leitura.' });
    }

    const conversation = await ensureInstallerConversation(authUser.id);
    const update = await pool.query(
      `
        UPDATE support_messages
        SET read_at = NOW()
        WHERE
          conversation_id = $1
          AND is_from_admin = TRUE
          AND read_at IS NULL
      `,
      [conversation.id]
    );

    const summary = await getConversationSummary(conversation.id);
    await emitConversationState(req, summary);

    return res.json({
      updated_count: update.rowCount || 0,
      conversation: serializeConversation(summary),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao marcar mensagens como lidas.' });
  }
};

exports.markAdminConversationAsRead = async (req, res) => {
  try {
    const conversationId = parsePositiveInt(req.params.conversationId);

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversa inválida.' });
    }

    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    const update = await pool.query(
      `
        UPDATE support_messages
        SET read_at = NOW()
        WHERE
          conversation_id = $1
          AND is_from_admin = FALSE
          AND read_at IS NULL
      `,
      [conversationId]
    );

    const summary = await getConversationSummary(conversationId);
    await emitConversationState(req, summary);

    return res.json({
      updated_count: update.rowCount || 0,
      conversation: serializeConversation(summary),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar leitura da conversa.' });
  }
};

exports.updateConversationStatus = async (req, res) => {
  try {
    const conversationId = parsePositiveInt(req.params.conversationId);
    const nextStatus = String(req.body.status || '').trim().toLowerCase();

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversa inválida.' });
    }

    if (!['open', 'closed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Status inválido. Use open ou closed.' });
    }

    const result = await pool.query(
      `
        UPDATE support_conversations
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `,
      [nextStatus, conversationId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    const summary = await getConversationSummary(conversationId);
    await emitConversationState(req, summary);

    return res.json({
      conversation: serializeConversation(summary),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar status da conversa.' });
  }
};

exports.getMyIdeas = async (req, res) => {
  try {
    const authUser = await getAuthUser(req.userId);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (authUser.is_admin) {
      return res.status(403).json({ error: 'Use os endpoints administrativos para visualizar ideias.' });
    }

    const limit = parseLimit(req.query.limit, 80, 200);
    const result = await pool.query(
      `
        SELECT
          i.id,
          i.installer_id,
          i.title,
          i.description,
          i.category,
          i.status,
          i.admin_note,
          i.reviewed_by,
          i.reviewed_at,
          i.created_at,
          i.updated_at,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
          u.email AS installer_email,
          COALESCE(NULLIF(reviewer.business_name, ''), reviewer.name) AS reviewed_by_name
        FROM support_ideas i
        JOIN users u ON u.id = i.installer_id
        LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
        WHERE i.installer_id = $1
        ORDER BY i.created_at DESC
        LIMIT $2
      `,
      [authUser.id, limit]
    );

    return res.json({
      ideas: result.rows.map(serializeIdea),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar suas ideias de melhoria.' });
  }
};

exports.createIdea = async (req, res) => {
  try {
    const authUser = await getAuthUser(req.userId);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (authUser.is_admin) {
      return res.status(403).json({ error: 'A criação de ideias é destinada aos instaladores.' });
    }

    const title = normalizeIdeaTitle(req.body.title);
    const description = normalizeIdeaDescription(req.body.description);
    const category = normalizeIdeaCategory(req.body.category);

    if (!title) {
      return res.status(400).json({ error: 'Informe um título com pelo menos 8 caracteres.' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Descreva a ideia com pelo menos 20 caracteres.' });
    }

    const insertResult = await pool.query(
      `
        INSERT INTO support_ideas (installer_id, title, description, category, status)
        VALUES ($1, $2, $3, $4, 'new')
        RETURNING id
      `,
      [authUser.id, title, description, category]
    );

    const ideaId = insertResult.rows[0]?.id;
    const idea = await getIdeaById(ideaId);

    await pool.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', FALSE)
      `,
      [
        authUser.id,
        'Ideia enviada para avaliação',
        'Recebemos sua sugestão. O time administrativo vai analisar em breve.',
      ]
    );

    await emitIdeaUpdate(req, idea, 'support:idea_created');

    return res.status(201).json({ idea: serializeIdea(idea) });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao enviar ideia de melhoria.' });
  }
};

exports.getAdminIdeas = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 120, 250);
    const search = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const safeStatus = status === 'all' || IDEA_STATUSES.has(status) ? status : 'all';

    const result = await pool.query(
      `
        SELECT
          i.id,
          i.installer_id,
          i.title,
          i.description,
          i.category,
          i.status,
          i.admin_note,
          i.reviewed_by,
          i.reviewed_at,
          i.created_at,
          i.updated_at,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name,
          u.email AS installer_email,
          COALESCE(NULLIF(reviewer.business_name, ''), reviewer.name) AS reviewed_by_name
        FROM support_ideas i
        JOIN users u ON u.id = i.installer_id
        LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
        WHERE
          ($1 = '' OR i.title ILIKE ('%' || $1 || '%') OR i.description ILIKE ('%' || $1 || '%') OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
          AND ($2 = 'all' OR i.status = $2)
        ORDER BY
          CASE i.status
            WHEN 'new' THEN 0
            WHEN 'reviewing' THEN 1
            WHEN 'planned' THEN 2
            WHEN 'done' THEN 3
            WHEN 'rejected' THEN 4
            ELSE 9
          END ASC,
          i.created_at DESC
        LIMIT $3
      `,
      [search, safeStatus, limit]
    );

    return res.json({
      ideas: result.rows.map(serializeIdea),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar ideias para o administrador.' });
  }
};

exports.updateIdea = async (req, res) => {
  try {
    const ideaId = parsePositiveInt(req.params.ideaId);

    if (!ideaId) {
      return res.status(400).json({ error: 'Ideia inválida.' });
    }

    const hasStatusField = Object.prototype.hasOwnProperty.call(req.body, 'status');
    const hasNoteField = Object.prototype.hasOwnProperty.call(req.body, 'admin_note');

    if (!hasStatusField && !hasNoteField) {
      return res.status(400).json({ error: 'Informe status ou observação administrativa para atualizar.' });
    }

    const status = hasStatusField ? normalizeIdeaStatus(req.body.status) : null;

    if (hasStatusField && !status) {
      return res.status(400).json({ error: 'Status inválido para ideia.' });
    }

    const adminNote = normalizeOptionalNote(req.body.admin_note);
    const existingIdea = await getIdeaById(ideaId);

    if (!existingIdea) {
      return res.status(404).json({ error: 'Ideia não encontrada.' });
    }

    await pool.query(
      `
        UPDATE support_ideas
        SET
          status = COALESCE($1, status),
          admin_note = CASE WHEN $2 THEN $3 ELSE admin_note END,
          reviewed_by = $4,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $5
      `,
      [status, hasNoteField, hasNoteField ? adminNote : null, req.userId, ideaId]
    );

    const updatedIdea = await getIdeaById(ideaId);
    const currentStatus = updatedIdea?.status || existingIdea.status;
    const statusChanged = hasStatusField && status !== existingIdea.status;
    const noteChanged = hasNoteField;
    const infoChunks = [];

    if (statusChanged) {
      infoChunks.push(`Status atualizado para "${currentStatus}".`);
    }

    if (noteChanged && adminNote) {
      infoChunks.push('O administrador deixou um comentário na sua ideia.');
    }

    if (noteChanged && !adminNote) {
      infoChunks.push('O comentário administrativo foi removido.');
    }

    if (infoChunks.length > 0) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, 'info', FALSE)
        `,
        [
          updatedIdea.installer_id,
          'Atualização na sua ideia de melhoria',
          infoChunks.join(' '),
        ]
      );
    }

    await emitIdeaUpdate(req, updatedIdea, 'support:idea_updated');

    return res.json({
      idea: serializeIdea(updatedIdea),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar ideia de melhoria.' });
  }
};
