const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const hasDiscreteConfig =
  process.env.DB_HOST ||
  process.env.DB_PORT ||
  process.env.DB_NAME ||
  process.env.DB_USER ||
  process.env.DB_PASSWORD;

const shouldUseSsl =
  process.env.DATABASE_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && Boolean(connectionString) && process.env.DATABASE_SSL !== 'false');

function withOptionalSsl(config) {
  return shouldUseSsl
    ? {
        ...config,
        ssl: { rejectUnauthorized: false },
      }
    : config;
}

const pool = new Pool(
  hasDiscreteConfig
    ? withOptionalSsl({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        database: process.env.DB_NAME,
      })
    : connectionString
      ? withOptionalSsl({ connectionString })
      : withOptionalSsl({
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          database: process.env.DB_NAME,
        })
);

module.exports = pool;
