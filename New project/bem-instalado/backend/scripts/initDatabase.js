const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

async function initDatabase() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = (await fs.readFile(schemaPath, 'utf8')).replace(/^\uFEFF/, '');

  try {
    await pool.query(schema);
    console.log('Schema do banco validado com sucesso.');
  } finally {
    await pool.end();
  }
}

initDatabase().catch((error) => {
  console.error('Falha ao inicializar o banco de dados.');
  console.error(error);
  process.exit(1);
});
