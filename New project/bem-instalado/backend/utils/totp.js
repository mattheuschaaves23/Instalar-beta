const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

exports.generateSecret = () =>
  speakeasy.generateSecret({
    name: 'Bem Instalado',
    issuer: 'Bem Instalado',
    length: 20,
  });

exports.verifyToken = (secret, token) =>
  speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });

exports.generateQrCode = async (secret, email) => {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: `Bem Instalado (${email})`,
    issuer: 'Bem Instalado',
    encoding: 'base32',
  });

  return QRCode.toDataURL(otpauthUrl);
};
