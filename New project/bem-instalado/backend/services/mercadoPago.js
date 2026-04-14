const crypto = require('crypto');

const API_BASE = (process.env.MERCADOPAGO_API_BASE || 'https://api.mercadopago.com').replace(/\/+$/, '');

function isMercadoPagoEnabled() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isPublicUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    return !['localhost', '127.0.0.1', '0.0.0.0'].includes(host);
  } catch (_error) {
    return false;
  }
}

function getWebhookUrl() {
  const baseUrl = normalizeUrl(
    process.env.MERCADOPAGO_WEBHOOK_URL || process.env.APP_URL || process.env.FRONTEND_URL
  );

  if (!isPublicUrl(baseUrl)) {
    return '';
  }

  const webhookToken = String(process.env.MERCADOPAGO_WEBHOOK_TOKEN || '').trim();
  const params = new URLSearchParams({ source_news: 'webhooks' });

  if (webhookToken) {
    params.set('token', webhookToken);
  }

  return `${baseUrl}/api/subscriptions/webhook/mercadopago?${params.toString()}`;
}

function getStatementDescriptor() {
  return String(process.env.MERCADOPAGO_STATEMENT_DESCRIPTOR || 'BEM INSTALADO')
    .trim()
    .slice(0, 22);
}

function getExpirationDate() {
  const minutes = Number(process.env.MERCADOPAGO_PIX_EXPIRATION_MINUTES || 30);
  const expiresAt = new Date(Date.now() + Math.max(minutes, 5) * 60 * 1000);

  return expiresAt.toISOString();
}

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || 'Cliente',
    lastName: parts.slice(1).join(' ') || 'Bem Instalado',
  };
}

async function mercadoPagoRequest(path, options = {}) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Credenciais do Mercado Pago nao configuradas.');
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const causes = Array.isArray(data?.cause)
      ? data.cause.map((item) => item.description || item.code).filter(Boolean).join(' ')
      : '';
    const isCredentialFailure = response.status === 401 || response.status === 403;
    const message = isCredentialFailure
      ? 'Credenciais do Mercado Pago rejeitadas.'
      : data?.message || data?.error || `Mercado Pago respondeu com status ${response.status}.`;
    const error = new Error([message, causes].filter(Boolean).join(' '));
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data || {};
}

function buildQrCodeImage(base64) {
  if (!base64) {
    return '';
  }

  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

function serializeMercadoPagoPayment(payment) {
  const transactionData = payment?.point_of_interaction?.transaction_data || {};

  return {
    provider: 'mercado_pago',
    providerPaymentId: payment?.id ? String(payment.id) : '',
    externalReference: payment?.external_reference || '',
    status: payment?.status || 'pending',
    statusDetail: payment?.status_detail || '',
    copyPaste: transactionData.qr_code || '',
    qrCodeImage: buildQrCodeImage(transactionData.qr_code_base64),
    ticketUrl: transactionData.ticket_url || '',
    expirationDate: payment?.date_of_expiration || null,
    raw: payment,
  };
}

function mapMercadoPagoStatus(status) {
  if (status === 'approved') {
    return 'paid';
  }

  if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(status)) {
    return 'failed';
  }

  return 'pending';
}

async function createMercadoPagoPixPayment({
  amount,
  description,
  externalReference,
  payerEmail,
  payerName,
}) {
  const { firstName, lastName } = splitName(payerName);
  const webhookUrl = getWebhookUrl();
  const body = {
    transaction_amount: Number(amount),
    description: description || process.env.PIX_DESCRIPTION || 'Assinatura Bem Instalado',
    payment_method_id: 'pix',
    external_reference: externalReference,
    date_of_expiration: getExpirationDate(),
    payer: {
      email: payerEmail,
      first_name: firstName,
      last_name: lastName,
    },
    statement_descriptor: getStatementDescriptor(),
  };

  if (webhookUrl) {
    body.notification_url = webhookUrl;
  }

  const payment = await mercadoPagoRequest('/v1/payments', {
    method: 'POST',
    body,
    idempotencyKey: crypto.randomUUID(),
  });

  return serializeMercadoPagoPayment(payment);
}

async function getMercadoPagoPayment(providerPaymentId) {
  const payment = await mercadoPagoRequest(`/v1/payments/${providerPaymentId}`);
  return serializeMercadoPagoPayment(payment);
}

module.exports = {
  createMercadoPagoPixPayment,
  getMercadoPagoPayment,
  getWebhookUrl,
  isMercadoPagoEnabled,
  mapMercadoPagoStatus,
};
