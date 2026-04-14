const insecureSecrets = new Set(['troque_essa_chave', 'changeme', 'secret', 'jwt_secret']);
const configuredSecret = String(process.env.JWT_SECRET || '').trim();

if (!configuredSecret || insecureSecrets.has(configuredSecret.toLowerCase()) || configuredSecret.length < 32) {
  throw new Error(
    'JWT_SECRET inválido. Configure uma chave forte (mínimo de 32 caracteres) no arquivo .env antes de iniciar o backend.'
  );
}

module.exports = {
  jwtSecret: configuredSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
