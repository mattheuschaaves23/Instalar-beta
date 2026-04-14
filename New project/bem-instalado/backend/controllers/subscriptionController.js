const crypto = require('crypto');
const pool = require('../config/database');
const { generatePix, getPixConfig } = require('../utils/pix');
const { logAudit } = require('../utils/auditLog');
const {
  createMercadoPagoPixPayment,
  getMercadoPagoPayment,
  isMercadoPagoEnabled,
  mapMercadoPagoStatus,
} = require('../services/mercadoPago');

const SUBSCRIPTION_AMOUNT = Number(process.env.SUBSCRIPTION_PRICE || 40);

function getPlanBenefits() {
  return [
    'Dashboard completo com métricas comerciais.',
    'Agenda visual com confirmação de instalação.',
    'Orçamentos profissionais com PDF premium.',
    'Perfil público com avaliações e vitrine para clientes.',
    'Suporte interno em tempo real com o administrador.',
  ];
}

function isManualConfirmationEnabled() {
  return process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRMATION === 'true' && process.env.NODE_ENV !== 'production';
}

function getSubscriptionAccessState(subscription) {
  const isExpired = Boolean(subscription?.expires_at && new Date(subscription.expires_at) < new Date());
  const canUseApp = Boolean(subscription && subscription.status === 'active' && !isExpired);

  return {
    canUseApp,
    isExpired,
    requiresPayment: !canUseApp,
  };
}

function getProviderErrorMessage(error, fallbackMessage) {
  if (error?.status === 401 || error?.status === 403) {
    return 'O Mercado Pago recusou as credenciais configuradas. Atualize o access token para voltar a cobrar.';
  }

  if (error?.status === 400 && error?.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getProviderPayload(payment) {
  if (!payment?.provider_payload) {
    return {};
  }

  if (typeof payment.provider_payload === 'string') {
    try {
      return JSON.parse(payment.provider_payload);
    } catch (_error) {
      return {};
    }
  }

  return payment.provider_payload;
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidWebhookToken(req) {
  const expectedToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || '').trim();

  if (!expectedToken) {
    return false;
  }

  const providedToken = String(
    req.query.token || req.headers['x-webhook-token'] || req.headers['x-mercadopago-token'] || ''
  ).trim();

  return safeCompare(expectedToken, providedToken);
}

function buildWebhookEventId({ req, providerPaymentId, eventType }) {
  const explicitId = String(
    req.body?.id ||
      req.headers['x-request-id'] ||
      req.headers['x-idempotency-key'] ||
      ''
  ).trim();

  if (explicitId) {
    return explicitId.slice(0, 160);
  }

  const rawFingerprint = JSON.stringify({
    eventType: eventType || 'payment',
    providerPaymentId: providerPaymentId || '',
    dataId: req.body?.data?.id || req.query['data.id'] || req.query.id || '',
  });

  return crypto.createHash('sha256').update(rawFingerprint).digest('hex').slice(0, 160);
}

async function registerWebhookEvent({ eventId, eventType, providerPaymentId, payload }) {
  const result = await pool.query(
    `
      INSERT INTO payment_webhook_events (
        provider,
        event_id,
        event_type,
        provider_payment_id,
        payload
      )
      VALUES ('mercado_pago', $1, $2, $3, $4::jsonb)
      ON CONFLICT (provider, event_id) DO UPDATE
      SET
        event_type = COALESCE(EXCLUDED.event_type, payment_webhook_events.event_type),
        provider_payment_id = COALESCE(EXCLUDED.provider_payment_id, payment_webhook_events.provider_payment_id),
        payload = EXCLUDED.payload
      RETURNING id, processed
    `,
    [eventId, eventType || null, providerPaymentId || null, JSON.stringify(payload || {})]
  );

  return result.rows[0] || null;
}

async function markWebhookEventProcessed(eventRowId) {
  if (!eventRowId) {
    return;
  }

  await pool.query(
    `
      UPDATE payment_webhook_events
      SET processed = TRUE, processed_at = NOW()
      WHERE id = $1
    `,
    [eventRowId]
  );
}

function serializeStoredPayment(payment) {
  const provider = payment.provider || 'manual';
  const payload = getProviderPayload(payment);
  const pixConfig = getPixConfig();
  const isAutomatic = provider === 'mercado_pago';

  return {
    payment: {
      id: payment.id,
      external_id: payment.external_id,
      amount: payment.amount,
      status: payment.status,
      created_at: payment.created_at,
      provider,
      provider_payment_id: payment.provider_payment_id || '',
      status_detail: payload.statusDetail || '',
    },
    qrCodeImage: payment.pix_qr_code,
    copyPaste: payment.pix_copy_paste,
    pixKey: isAutomatic ? '' : pixConfig.pixKey,
    recipientName: isAutomatic ? payload.recipientName || '' : pixConfig.recipientName,
    city: isAutomatic ? payload.city || '' : pixConfig.city,
    description: isAutomatic ? payload.description || 'Assinatura Bem Instalado' : pixConfig.description,
    ticketUrl: payload.ticketUrl || '',
    expirationDate: payload.expirationDate || null,
    manualConfirmation: !isAutomatic,
    automaticConfirmation: isAutomatic,
    provider,
  };
}

async function getLatestSubscription(userId) {
  const result = await pool.query(
    `
      SELECT *
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function ensureSubscription(userId) {
  const existing = await getLatestSubscription(userId);

  if (existing) {
    return existing;
  }

  const created = await pool.query(
    `
      INSERT INTO subscriptions (user_id, plan, status)
      VALUES ($1, 'monthly', 'inactive')
      RETURNING *
    `,
    [userId]
  );

  return created.rows[0];
}

async function getPendingPayment(userId, db = pool) {
  const allowManualConfirmation = isManualConfirmationEnabled();
  const result = await db.query(
    `
      SELECT *
      FROM payments
      WHERE user_id = $1
        AND status = 'pending'
        AND ($2::boolean = true OR provider <> 'manual')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, allowManualConfirmation]
  );

  return result.rows[0] || null;
}

async function getPaymentByExternalId(externalId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM payments
      WHERE external_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [externalId, userId]
  );

  return result.rows[0] || null;
}

async function getUserProfile(userId) {
  const result = await pool.query(
    `
      SELECT id, name, email
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function activateSubscription(payment) {
  const db = await pool.connect();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  try {
    await db.query('BEGIN');

    const updatedPaymentResult = await db.query(
      `UPDATE payments SET status = 'paid', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [payment.id]
    );
    const updatedPayment = updatedPaymentResult.rows[0];

    await db.query(
      `
        UPDATE subscriptions
        SET status = 'active', expires_at = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [expiresAt, payment.subscription_id]
    );

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [payment.user_id, 'Pagamento confirmado', 'Sua assinatura foi ativada com sucesso.']
    );

    await db.query('COMMIT');

    await logAudit({
      actorUserId: null,
      action: 'subscription.payment_activated',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        userId: payment.user_id,
        subscriptionId: payment.subscription_id,
        provider: payment.provider || 'manual',
      },
    });

    return updatedPayment;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    db.release();
  }
}

async function updatePaymentWithMercadoPagoData(payment, remotePayment) {
  const existingPayload = getProviderPayload(payment);
  const localStatus = mapMercadoPagoStatus(remotePayment.status);
  const mergedPayload = {
    ...existingPayload,
    provider: 'mercado_pago',
    status: remotePayment.status,
    statusDetail: remotePayment.statusDetail || '',
    ticketUrl: remotePayment.ticketUrl || existingPayload.ticketUrl || '',
    expirationDate: remotePayment.expirationDate || existingPayload.expirationDate || null,
    description: existingPayload.description || process.env.PIX_DESCRIPTION || 'Assinatura Bem Instalado',
    recipientName: existingPayload.recipientName || '',
    city: existingPayload.city || '',
  };

  const result = await pool.query(
    `
      UPDATE payments
      SET
        status = $1,
        provider = 'mercado_pago',
        provider_payment_id = COALESCE($2, provider_payment_id),
        pix_qr_code = COALESCE(NULLIF($3, ''), pix_qr_code),
        pix_copy_paste = COALESCE(NULLIF($4, ''), pix_copy_paste),
        provider_payload = $5::jsonb,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `,
    [
      localStatus,
      remotePayment.providerPaymentId || null,
      remotePayment.qrCodeImage || '',
      remotePayment.copyPaste || '',
      JSON.stringify(mergedPayload),
      payment.id,
    ]
  );

  return result.rows[0];
}

async function syncMercadoPagoPayment(payment) {
  if (payment.provider !== 'mercado_pago' || !payment.provider_payment_id || !isMercadoPagoEnabled()) {
    return payment;
  }

  const remotePayment = await getMercadoPagoPayment(payment.provider_payment_id);
  const updatedPayment = await updatePaymentWithMercadoPagoData(payment, remotePayment);

  if (updatedPayment.status === 'paid' && payment.status !== 'paid') {
    return activateSubscription(updatedPayment);
  }

  return updatedPayment;
}

async function findPaymentByProviderReference(providerPaymentId, externalReference) {
  if (providerPaymentId) {
    const byProviderId = await pool.query(
      `
        SELECT *
        FROM payments
        WHERE provider_payment_id = $1
        LIMIT 1
      `,
      [providerPaymentId]
    );

    if (byProviderId.rows[0]) {
      return byProviderId.rows[0];
    }
  }

  if (!externalReference) {
    return null;
  }

  const byExternalId = await pool.query(
    `
      SELECT *
      FROM payments
      WHERE external_id = $1
      LIMIT 1
    `,
    [externalReference]
  );

  return byExternalId.rows[0] || null;
}

exports.getSubscription = async (req, res) => {
  try {
    let pendingPayment = await getPendingPayment(req.userId);
    let providerError = null;

    if (pendingPayment?.provider === 'mercado_pago') {
      try {
        pendingPayment = await syncMercadoPagoPayment(pendingPayment);
      } catch (error) {
        providerError = getProviderErrorMessage(error, 'Não foi possível sincronizar o pagamento agora.');
      }
    }

    const subscription = await getLatestSubscription(req.userId);
    const accessState = getSubscriptionAccessState(subscription);

    return res.json({
      ...(subscription || { status: 'inactive', plan: 'monthly' }),
      can_use_app: accessState.canUseApp,
      is_expired: accessState.isExpired,
      requires_payment: accessState.requiresPayment,
      pricing: {
        amount: SUBSCRIPTION_AMOUNT,
        currency: 'BRL',
        period: 'mensal',
        label: 'Plano instalador',
      },
      plan_benefits: getPlanBenefits(),
      payment_mode: isMercadoPagoEnabled() ? 'automatic' : isManualConfirmationEnabled() ? 'manual' : 'disabled',
      provider_error: providerError,
      pending_payment: pendingPayment && pendingPayment.status === 'pending'
        ? serializeStoredPayment(pendingPayment)
        : null,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar assinatura.' });
  }
};

exports.createPayment = async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock($1)', [Number(req.userId)]);

    let pendingPayment = await getPendingPayment(req.userId, db);

    if (pendingPayment?.status === 'pending') {
      await db.query('COMMIT');
      if (pendingPayment.provider === 'mercado_pago') {
        pendingPayment = await syncMercadoPagoPayment(pendingPayment);
      }
      return res.json(serializeStoredPayment(pendingPayment));
    }

    const subscription = await ensureSubscription(req.userId);

    if (isMercadoPagoEnabled()) {
      const user = await getUserProfile(req.userId);

      if (!user?.email) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'O usuário precisa ter um email válido para gerar o PIX.' });
      }

      const externalId = crypto.randomBytes(12).toString('hex');
      const remotePayment = await createMercadoPagoPixPayment({
        amount: SUBSCRIPTION_AMOUNT,
        description: process.env.PIX_DESCRIPTION || 'Assinatura Bem Instalado',
        externalReference: externalId,
        payerEmail: user.email,
        payerName: user.name,
      });

      const paymentResult = await db.query(
        `
          INSERT INTO payments (
            user_id,
            subscription_id,
            amount,
            method,
            status,
            external_id,
            provider,
            provider_payment_id,
            pix_qr_code,
            pix_copy_paste,
            provider_payload
          )
          VALUES ($1, $2, $3, 'pix', $4, $5, 'mercado_pago', $6, $7, $8, $9::jsonb)
          RETURNING *
        `,
        [
          req.userId,
          subscription.id,
          SUBSCRIPTION_AMOUNT,
          mapMercadoPagoStatus(remotePayment.status),
          externalId,
          remotePayment.providerPaymentId || null,
          remotePayment.qrCodeImage,
          remotePayment.copyPaste,
          JSON.stringify({
            provider: 'mercado_pago',
            status: remotePayment.status,
            statusDetail: remotePayment.statusDetail || '',
            ticketUrl: remotePayment.ticketUrl || '',
            expirationDate: remotePayment.expirationDate || null,
            description: process.env.PIX_DESCRIPTION || 'Assinatura Bem Instalado',
            recipientName: '',
            city: '',
          }),
        ]
      );

      await db.query('COMMIT');
      let storedPayment = paymentResult.rows[0];

      if (storedPayment.status === 'paid') {
        storedPayment = await activateSubscription(storedPayment);
      }

      await logAudit({
        actorUserId: req.userId,
        action: 'subscription.payment_created',
        entityType: 'payment',
        entityId: storedPayment.id,
        metadata: {
          provider: 'mercado_pago',
          externalId,
          status: storedPayment.status,
        },
        req,
      });

      return res.json(serializeStoredPayment(storedPayment));
    }

    if (!isManualConfirmationEnabled()) {
      await db.query('ROLLBACK');
      return res.status(503).json({ error: 'Gateway de pagamento não configurado para liberar acessos.' });
    }

    const manualPix = await generatePix(SUBSCRIPTION_AMOUNT);
    const paymentResult = await db.query(
      `
        INSERT INTO payments (
          user_id,
          subscription_id,
          amount,
          method,
          status,
          external_id,
          provider,
          pix_qr_code,
          pix_copy_paste,
          provider_payload
        )
        VALUES ($1, $2, $3, 'pix', 'pending', $4, 'manual', $5, $6, $7::jsonb)
        RETURNING *
      `,
      [
        req.userId,
        subscription.id,
        SUBSCRIPTION_AMOUNT,
        manualPix.externalId,
        manualPix.qrCodeImage,
        manualPix.copyPaste,
        JSON.stringify({
          provider: 'manual',
          description: manualPix.description,
          recipientName: manualPix.recipientName,
          city: manualPix.city,
        }),
      ]
    );

    await db.query('COMMIT');

    await logAudit({
      actorUserId: req.userId,
      action: 'subscription.payment_created',
      entityType: 'payment',
      entityId: paymentResult.rows[0].id,
      metadata: {
        provider: 'manual',
        externalId: manualPix.externalId,
        status: paymentResult.rows[0].status,
      },
      req,
    });

    return res.json(serializeStoredPayment(paymentResult.rows[0]));
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null);
    console.error('Erro ao gerar pagamento da assinatura.');
    console.error(error);
    const message = getProviderErrorMessage(error, 'Erro ao gerar pagamento.');
    const statusCode = error?.status === 400 || error?.status === 401 || error?.status === 403 ? 502 : 500;
    return res.status(statusCode).json({ error: message });
  } finally {
    db.release();
  }
};

exports.checkPayment = async (req, res) => {
  try {
    let payment = await getPaymentByExternalId(req.params.externalId, req.userId);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    if (payment.provider === 'mercado_pago') {
      payment = await syncMercadoPagoPayment(payment);
    }

    return res.json({ status: payment.status, ...serializeStoredPayment(payment) });
  } catch (error) {
    const message = getProviderErrorMessage(error, 'Erro ao verificar pagamento.');
    const statusCode = error?.status === 400 || error?.status === 401 || error?.status === 403 ? 502 : 500;
    return res.status(statusCode).json({ error: message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const payment = await getPaymentByExternalId(req.params.externalId, req.userId);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    if (payment.provider === 'mercado_pago') {
      const syncedPayment = await syncMercadoPagoPayment(payment);

      if (syncedPayment.status === 'paid') {
        return res.json({ status: 'paid' });
      }

      return res.status(409).json({ error: 'Pagamento ainda não foi confirmado pelo Mercado Pago.' });
    }

    if (!isManualConfirmationEnabled()) {
      return res.status(403).json({ error: 'Confirmação manual desativada neste ambiente.' });
    }

    if (payment.status !== 'paid') {
      await activateSubscription(payment);
    }

    await logAudit({
      actorUserId: req.userId,
      action: 'subscription.payment_confirmed_manual',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        provider: payment.provider || 'manual',
        externalId: payment.external_id,
      },
      req,
    });

    return res.json({ status: 'paid' });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
};

exports.handleMercadoPagoWebhook = async (req, res) => {
  try {
    if (!isMercadoPagoEnabled()) {
      return res.status(202).json({ received: true, ignored: 'mercado-pago-disabled' });
    }

    if (!hasValidWebhookToken(req)) {
      await logAudit({
        actorUserId: null,
        action: 'payment.webhook_denied',
        entityType: 'webhook',
        entityId: 'mercado_pago',
        metadata: {
          reason: 'invalid-token',
          hasTokenQuery: Boolean(req.query.token),
          requestId: String(req.headers['x-request-id'] || ''),
        },
        req,
      });

      return res.status(401).json({ error: 'Webhook não autorizado.' });
    }

    const providerPaymentId = String(
      req.body?.data?.id ||
        req.query['data.id'] ||
        req.query.id ||
        ''
    ).trim();
    const eventType = String(req.body?.type || req.query.type || req.body?.topic || req.query.topic || '').trim();
    const eventId = buildWebhookEventId({ req, providerPaymentId, eventType });

    if (!providerPaymentId || (eventType && eventType !== 'payment')) {
      return res.status(202).json({ received: true, ignored: 'unsupported-event' });
    }

    const webhookEvent = await registerWebhookEvent({
      eventId,
      eventType,
      providerPaymentId,
      payload: req.body,
    });

    if (!webhookEvent) {
      return res.status(202).json({ received: true, ignored: 'event-not-stored' });
    }

    if (webhookEvent.processed) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const remotePayment = await getMercadoPagoPayment(providerPaymentId);
    const payment = await findPaymentByProviderReference(
      remotePayment.providerPaymentId,
      remotePayment.externalReference
    );

    if (!payment) {
      await markWebhookEventProcessed(webhookEvent.id);
      return res.status(202).json({ received: true, ignored: 'payment-not-tracked' });
    }

    const updatedPayment = await updatePaymentWithMercadoPagoData(payment, remotePayment);

    if (updatedPayment.status === 'paid' && payment.status !== 'paid') {
      await activateSubscription(updatedPayment);
    }

    await markWebhookEventProcessed(webhookEvent.id);

    await logAudit({
      actorUserId: null,
      action: 'payment.webhook_processed',
      entityType: 'payment',
      entityId: updatedPayment.id,
      metadata: {
        provider: 'mercado_pago',
        providerPaymentId,
        externalId: updatedPayment.external_id,
        statusBefore: payment.status,
        statusAfter: updatedPayment.status,
      },
      req,
    });

    return res.json({ received: true });
  } catch (error) {
    console.error('Falha no webhook do Mercado Pago.');
    console.error(error);
    return res.status(500).json({ error: 'Falha ao processar webhook do Mercado Pago.' });
  }
};
