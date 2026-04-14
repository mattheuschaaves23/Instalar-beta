const crypto = require('crypto');
const QRCode = require('qrcode');

function field(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function normalizeText(value, maxLength) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function normalizeTxid(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25) || 'BEMINSTALADO';
}

function crc16(payload) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function getPixConfig() {
  const staticCode = process.env.PIX_STATIC_CODE || '';

  return {
    staticCode,
    pixKey: staticCode ? process.env.PIX_DISPLAY_KEY || '' : process.env.PIX_KEY || 'pagamentos@beminstalado.com',
    recipientName: normalizeText(process.env.PIX_RECIPIENT_NAME || 'Bem Instalado', 25),
    city: normalizeText(process.env.PIX_CITY || 'Sao Paulo', 15),
    description: normalizeText(process.env.PIX_DESCRIPTION || 'Assinatura Bem Instalado', 40),
  };
}

function buildPixPayload({ amount, txid, pixKey, recipientName, city, description }) {
  const merchantAccountInfo =
    field('00', 'br.gov.bcb.pix') +
    field('01', pixKey) +
    (description ? field('02', description) : '');

  const additionalData = field('05', normalizeTxid(txid));
  const basePayload =
    field('00', '01') +
    field('01', '12') +
    field('26', merchantAccountInfo) +
    field('52', '0000') +
    field('53', '986') +
    field('54', Number(amount || 0).toFixed(2)) +
    field('58', 'BR') +
    field('59', recipientName) +
    field('60', city) +
    field('62', additionalData) +
    '6304';

  return `${basePayload}${crc16(basePayload)}`;
}

function serializePaymentMeta(payment) {
  const config = getPixConfig();

  return {
    payment: {
      id: payment.id,
      external_id: payment.external_id,
      amount: payment.amount,
      status: payment.status,
      created_at: payment.created_at,
    },
    qrCodeImage: payment.pix_qr_code,
    copyPaste: payment.pix_copy_paste,
    pixKey: config.pixKey,
    recipientName: config.recipientName,
    city: config.city,
    description: config.description,
    provider: 'manual',
    manualConfirmation: true,
    automaticConfirmation: false,
  };
}

async function generatePix(amount, providedExternalId) {
  const config = getPixConfig();
  const externalId = providedExternalId || crypto.randomBytes(12).toString('hex');
  const copyPaste = config.staticCode
    ? config.staticCode
    : buildPixPayload({
        amount,
        txid: externalId,
        pixKey: config.pixKey,
        recipientName: config.recipientName,
        city: config.city,
        description: config.description,
      });
  const qrCodeImage = await QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 360,
    color: {
      dark: '#111111',
      light: '#FAF4E6',
    },
  });

  return {
    externalId,
    copyPaste,
    qrCodeImage,
    ...config,
  };
}

module.exports = {
  generatePix,
  getPixConfig,
  serializePaymentMeta,
};
