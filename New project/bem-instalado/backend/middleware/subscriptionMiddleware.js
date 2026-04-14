const pool = require('../config/database');
const {
  getMercadoPagoPayment,
  isMercadoPagoEnabled,
  mapMercadoPagoStatus,
} = require('../services/mercadoPago');

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

function isSubscriptionActive(subscription) {
  if (!subscription) {
    return false;
  }

  const isExpired = Boolean(subscription.expires_at && new Date(subscription.expires_at) < new Date());
  return subscription.status === 'active' && !isExpired;
}

async function activateSubscription(payment) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await pool.query(`UPDATE payments SET status = 'paid', updated_at = NOW() WHERE id = $1`, [payment.id]);
  await pool.query(
    `
      UPDATE subscriptions
      SET status = 'active', expires_at = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [expiresAt, payment.subscription_id]
  );
  await pool.query(
    `
      INSERT INTO notifications (user_id, title, message, type, read)
      VALUES ($1, $2, $3, 'success', false)
    `,
    [payment.user_id, 'Pagamento confirmado', 'Sua assinatura foi ativada com sucesso.']
  );
}

async function syncLatestMercadoPagoPayment(userId) {
  if (!isMercadoPagoEnabled()) {
    return null;
  }

  const paymentResult = await pool.query(
    `
      SELECT *
      FROM payments
      WHERE user_id = $1 AND status = 'pending' AND provider = 'mercado_pago'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  const payment = paymentResult.rows[0];

  if (!payment?.provider_payment_id) {
    return null;
  }

  const remotePayment = await getMercadoPagoPayment(payment.provider_payment_id);
  const localStatus = mapMercadoPagoStatus(remotePayment.status);
  const existingPayload = getProviderPayload(payment);
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

  const updatedResult = await pool.query(
    `
      UPDATE payments
      SET
        status = $1,
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

  const updatedPayment = updatedResult.rows[0];

  if (updatedPayment.status === 'paid' && payment.status !== 'paid') {
    await activateSubscription(updatedPayment);
  }

  return updatedPayment;
}

async function isAdmin(userId) {
  const result = await pool.query(
    `
      SELECT is_admin
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    return false;
  }

  return Boolean(user.is_admin);
}

module.exports = async (req, res, next) => {
  try {
    if (await isAdmin(req.userId)) {
      return next();
    }

    const subscriptionResult = await pool.query(
      `
        SELECT *
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    let subscription = subscriptionResult.rows[0] || null;

    if (isSubscriptionActive(subscription)) {
      return next();
    }

    await syncLatestMercadoPagoPayment(req.userId);

    const refreshedResult = await pool.query(
      `
        SELECT *
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    subscription = refreshedResult.rows[0] || null;

    if (isSubscriptionActive(subscription)) {
      return next();
    }

    return res.status(403).json({ error: 'Assinatura inativa.', code: 'SUBSCRIPTION_INACTIVE' });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao validar assinatura.' });
  }
};
