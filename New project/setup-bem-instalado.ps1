param(
  [string]$ProjectName = 'bem-instalado',
  [switch]$Install,
  [switch]$Start
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Join-Path $PSScriptRoot $ProjectName

function Write-ProjectFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $fullPath = Join-Path $projectRoot $RelativePath
  $directory = Split-Path -Path $fullPath -Parent

  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($fullPath, $Content, $utf8NoBom)
  Write-Host ("[ok] " + $RelativePath)
}

function Ensure-Directory {
  param([string]$RelativePath)

  $fullPath = Join-Path $projectRoot $RelativePath
  if (-not (Test-Path $fullPath)) {
    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
  }
}

$folders = @(
  'backend',
  'backend/config',
  'backend/controllers',
  'backend/db',
  'backend/middleware',
  'backend/models',
  'backend/routes',
  'backend/utils',
  'backend/temp',
  'frontend',
  'frontend/public',
  'frontend/src',
  'frontend/src/components',
  'frontend/src/components/Layout',
  'frontend/src/components/Auth',
  'frontend/src/components/Dashboard',
  'frontend/src/components/Clients',
  'frontend/src/components/Budgets',
  'frontend/src/components/Agenda',
  'frontend/src/components/Profile',
  'frontend/src/components/Subscription',
  'frontend/src/components/Notifications',
  'frontend/src/contexts',
  'frontend/src/services',
  'frontend/src/utils'
)

foreach ($folder in $folders) {
  Ensure-Directory $folder
}

# __ROOT_FILES__
Write-ProjectFile '.gitignore' @'
node_modules/
.env
.env.local
dist/
build/
backend/temp/
'@

Write-ProjectFile 'README.md' @'
# Bem Instalado

Projeto base em Node.js + React para uma plataforma SaaS de instaladores.

## Como usar

1. Execute o arquivo `setup-bem-instalado.ps1` na pasta raiz.
2. Depois, entre em `bem-instalado` e rode `.\start.ps1 -Install`.
3. Configure o PostgreSQL usando `backend\db\schema.sql`.
4. Copie `backend\.env.example` para `backend\.env`.
5. Copie `frontend\.env.example` para `frontend\.env`.

## Observacoes

- O script cria a estrutura completa do projeto e uma base executavel.
- O backend ja vem com rotas principais, mock de PIX e geracao de PDF.
- O frontend sobe com telas iniciais para autenticacao, clientes, orcamentos e agenda.
'@

Write-ProjectFile 'start.ps1' @'
param(
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Ensure-Env {
  param([string]$Folder)

  $envPath = Join-Path $Folder ".env"
  $examplePath = Join-Path $Folder ".env.example"

  if (-not (Test-Path $envPath) -and (Test-Path $examplePath)) {
    Copy-Item $examplePath $envPath
    Write-Host ("[info] Arquivo criado: " + $envPath)
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao encontrado. Instale Node.js antes de continuar."
}

Ensure-Env $backend
Ensure-Env $frontend

if ($Install -or -not (Test-Path (Join-Path $backend "node_modules"))) {
  Push-Location $backend
  npm install
  Pop-Location
}

if ($Install -or -not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend
  npm install
  Pop-Location
}

Write-Host "[info] Abra o PostgreSQL e rode backend\db\schema.sql antes de usar o sistema."

$backendCmd = "Set-Location '$backend'; npm run dev"
$frontendCmd = "Set-Location '$frontend'; npm start"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "[ok] Backend e frontend iniciados em janelas separadas."
'@
# __BACKEND_PART1__
Write-ProjectFile 'backend/package.json' @'
{
  "name": "bem-instalado-backend",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "jsonwebtoken": "^9.0.2",
    "pdfkit": "^0.15.0",
    "pg": "^8.13.1",
    "qrcode": "^1.5.4",
    "speakeasy": "^2.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
}
'@

Write-ProjectFile 'backend/.env.example' @'
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bem_instalado
JWT_SECRET=troque_essa_chave
FRONTEND_URL=http://localhost:3000
'@

Write-ProjectFile 'backend/config/database.js' @'
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
      }
);

module.exports = pool;
'@

Write-ProjectFile 'backend/config/auth.js' @'
module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'troque_essa_chave',
  jwtExpiresIn: '7d',
};
'@

Write-ProjectFile 'backend/middleware/authMiddleware.js' @'
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token nao informado.' });
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.id;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido.' });
  }
};
'@

Write-ProjectFile 'backend/middleware/subscriptionMiddleware.js' @'
const pool = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT status, expires_at
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    const subscription = rows[0];

    if (!subscription) {
      return res.status(403).json({ error: 'Assinatura nao encontrada.' });
    }

    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date();

    if (subscription.status !== 'active' || isExpired) {
      return res.status(403).json({ error: 'Assinatura inativa.' });
    }

    return next();
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao validar assinatura.' });
  }
};
'@

Write-ProjectFile 'backend/utils/totp.js' @'
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
'@

Write-ProjectFile 'backend/utils/pix.js' @'
const crypto = require('crypto');

exports.generatePix = async (amount) => {
  const externalId = crypto.randomBytes(12).toString('hex');
  const cleanAmount = Number(amount || 0).toFixed(2);
  const copyPaste = `PIX-BEM-INSTALADO-${externalId}-${cleanAmount}`;
  const qrCode = copyPaste;

  return {
    externalId,
    copyPaste,
    qrCode,
  };
};

exports.checkPix = async () => ({ status: 'paid' });
'@

Write-ProjectFile 'backend/utils/whatsapp.js' @'
module.exports = (phone, message) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};
'@

Write-ProjectFile 'backend/utils/generatePDF.js' @'
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

module.exports = function generateBudgetPDF({ budget, client, environments, user }) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '..', 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `orcamento-${budget.id}.pdf`);
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    doc.fontSize(22).text('Bem Instalado', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).text(`Orcamento #${budget.id}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Profissional: ${user.name}`);
    doc.text(`Cliente: ${client.name}`);
    doc.text(`Telefone: ${client.phone || '-'}`);
    doc.text(`Email: ${client.email || '-'}`);
    doc.text(`Endereco: ${client.address || '-'}`);
    doc.moveDown();
    doc.fontSize(13).text('Ambientes');
    doc.moveDown(0.5);

    environments.forEach((environment) => {
      doc
        .fontSize(11)
        .text(
          `${environment.name} | ${environment.height}m x ${environment.width}m | area ${Number(
            environment.area || 0
          ).toFixed(2)}m2 | rolos ${environment.rolls_manual || environment.rolls_auto} | R$ ${Number(
            environment.total || 0
          ).toFixed(2)}`
        );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: R$ ${Number(budget.subtotal_rolls || 0).toFixed(2)}`);
    doc.text(`Remocao: R$ ${Number(budget.removal_cost || 0).toFixed(2)}`);
    doc.text(`Total: R$ ${Number(budget.total_amount || 0).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(10).text('Documento gerado automaticamente pelo Bem Instalado.');
    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};
'@
# __BACKEND_PART2__
Write-ProjectFile 'backend/controllers/authController.js' @'
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');
const { generateSecret, verifyToken, generateQrCode } = require('../utils/totp');

function signToken(id) {
  return jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiresIn });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios.' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: 'Email ja cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `
        INSERT INTO users (name, email, password, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, phone, two_factor_enabled
      `,
      [name, email, passwordHash, phone || null]
    );

    const user = rows[0];

    await pool.query(
      `
        INSERT INTO subscriptions (user_id, plan, status)
        VALUES ($1, 'monthly', 'inactive')
      `,
      [user.id]
    );

    return res.status(201).json({ user, token: signToken(user.id) });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao registrar usuario.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    const validPassword = await bcrypt.compare(password || '', user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        return res.status(401).json({ error: 'Codigo 2FA necessario.', twoFactorRequired: true });
      }

      if (!verifyToken(user.two_factor_secret, twoFactorToken)) {
        return res.status(401).json({ error: 'Codigo 2FA invalido.' });
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        logo: user.logo,
        default_price_per_roll: user.default_price_per_roll,
        default_removal_price: user.default_removal_price,
        two_factor_enabled: user.two_factor_enabled,
      },
      token: signToken(user.id),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

exports.setup2FA = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    const secret = generateSecret();
    const qrCode = await generateQrCode(secret.base32, user.email);
    return res.json({ secret: secret.base32, qrCode });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao configurar 2FA.' });
  }
};

exports.enable2FA = async (req, res) => {
  try {
    const { secret, token } = req.body;

    if (!secret || !token || !verifyToken(secret, token)) {
      return res.status(400).json({ error: 'Dados de 2FA invalidos.' });
    }

    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = $1, two_factor_enabled = true, updated_at = NOW()
        WHERE id = $2
      `,
      [secret, req.userId]
    );

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = NULL, two_factor_enabled = false, updated_at = NOW()
        WHERE id = $1
      `,
      [req.userId]
    );

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao desativar 2FA.' });
  }
};

exports.forgotPassword = async (_req, res) =>
  res.status(501).json({ error: 'Recuperacao de senha ainda nao implementada.' });

exports.resetPassword = async (_req, res) =>
  res.status(501).json({ error: 'Reset de senha ainda nao implementado.' });
'@

Write-ProjectFile 'backend/controllers/userController.js' @'
const pool = require('../config/database');

exports.getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, name, email, phone, logo, default_price_per_roll, default_removal_price, two_factor_enabled
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar perfil.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, logo, default_price_per_roll, default_removal_price } = req.body;

    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          logo = COALESCE($3, logo),
          default_price_per_roll = COALESCE($4, default_price_per_roll),
          default_removal_price = COALESCE($5, default_removal_price),
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, name, email, phone, logo, default_price_per_roll, default_removal_price, two_factor_enabled
      `,
      [name, phone, logo, default_price_per_roll, default_removal_price, req.userId]
    );

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
};
'@

Write-ProjectFile 'backend/controllers/clientController.js' @'
const pool = require('../config/database');

exports.createClient = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone sao obrigatorios.' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO clients (user_id, name, phone, email, address)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [req.userId, name, phone, email || null, address || null]
    );

    return res.status(201).json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
};

exports.getClients = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
};

exports.getClient = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    const { rows } = await pool.query(
      `
        UPDATE clients
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          address = COALESCE($4, address),
          updated_at = NOW()
        WHERE id = $5 AND user_id = $6
        RETURNING *
      `,
      [name, phone, email, address, req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
};
'@

Write-ProjectFile 'backend/controllers/subscriptionController.js' @'
const pool = require('../config/database');
const { generatePix, checkPix } = require('../utils/pix');

exports.getSubscription = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    return res.json(rows[0] || { status: 'inactive', plan: 'monthly' });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar assinatura.' });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const amount = 49.9;
    const pix = await generatePix(amount);

    let subscriptionResult = await pool.query(
      `
        SELECT *
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    let subscription = subscriptionResult.rows[0];

    if (!subscription) {
      const created = await pool.query(
        `
          INSERT INTO subscriptions (user_id, plan, status)
          VALUES ($1, 'monthly', 'inactive')
          RETURNING *
        `,
        [req.userId]
      );

      subscription = created.rows[0];
    }

    const paymentResult = await pool.query(
      `
        INSERT INTO payments (
          user_id, subscription_id, amount, method, status, external_id, pix_qr_code, pix_copy_paste
        )
        VALUES ($1, $2, $3, 'pix', 'pending', $4, $5, $6)
        RETURNING *
      `,
      [req.userId, subscription.id, amount, pix.externalId, pix.qrCode, pix.copyPaste]
    );

    return res.json({ payment: paymentResult.rows[0], qrCode: pix.qrCode, copyPaste: pix.copyPaste });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao gerar pagamento.' });
  }
};

exports.checkPayment = async (req, res) => {
  try {
    const paymentResult = await pool.query(
      `
        SELECT *
        FROM payments
        WHERE external_id = $1
        LIMIT 1
      `,
      [req.params.externalId]
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento nao encontrado.' });
    }

    const pixStatus = await checkPix(req.params.externalId);

    if (pixStatus.status === 'paid') {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await pool.query(`UPDATE payments SET status = 'paid', updated_at = NOW() WHERE id = $1`, [payment.id]);
      await pool.query(
        `UPDATE subscriptions SET status = 'active', expires_at = $1, updated_at = NOW() WHERE id = $2`,
        [expiresAt, payment.subscription_id]
      );
    }

    return res.json({ status: pixStatus.status });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
};
'@

Write-ProjectFile 'backend/controllers/notificationController.js' @'
const pool = require('../config/database');

exports.getNotifications = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar notificacoes.' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        UPDATE notifications
        SET read = true
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Notificacao nao encontrada.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar notificacao.' });
  }
};
'@

Write-ProjectFile 'backend/controllers/scheduleController.js' @'
const pool = require('../config/database');

exports.getSchedules = async (req, res) => {
  try {
    const params = [req.userId];
    let query = `
      SELECT s.*, c.name AS client_name
      FROM schedules s
      JOIN clients c ON c.id = s.client_id
      WHERE s.user_id = $1
    `;

    if (req.query.start && req.query.end) {
      query += ' AND s.date BETWEEN $2 AND $3';
      params.push(req.query.start, req.query.end);
    }

    query += ' ORDER BY s.date ASC';

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar agenda.' });
  }
};

exports.updateScheduleStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const { rows } = await pool.query(
      `
        UPDATE schedules
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [status, req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Evento nao encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar agenda.' });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM schedules
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Evento nao encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir evento.' });
  }
};
'@

Write-ProjectFile 'backend/controllers/paymentController.js' @'
module.exports = {};
'@
# __BACKEND_PART3__
Write-ProjectFile 'backend/controllers/budgetController.js' @'
const fs = require('fs/promises');
const pool = require('../config/database');
const generateBudgetPDF = require('../utils/generatePDF');
const generateWhatsAppLink = require('../utils/whatsapp');

const ROLL_AREA = 4.5;

function normalizeNumber(value) {
  return Number(value || 0);
}

exports.createBudget = async (req, res) => {
  const db = await pool.connect();

  try {
    const { client_id, environments, removal_included, removal_price, price_per_roll } = req.body;

    if (!client_id || !Array.isArray(environments) || environments.length === 0) {
      return res.status(400).json({ error: 'Cliente e ambientes sao obrigatorios.' });
    }

    const clientCheck = await db.query('SELECT id FROM clients WHERE id = $1 AND user_id = $2', [client_id, req.userId]);

    if (!clientCheck.rowCount) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    const cleanPricePerRoll = normalizeNumber(price_per_roll);
    let totalArea = 0;
    let totalRolls = 0;
    let subtotal = 0;

    const computedEnvironments = environments.map((environment) => {
      const height = normalizeNumber(environment.height);
      const width = normalizeNumber(environment.width);
      const area = height * width;
      const rollsAuto = Math.ceil(area / ROLL_AREA);
      const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
      const rollsUsed = rollsManual || rollsAuto;
      const total = rollsUsed * cleanPricePerRoll;

      totalArea += area;
      totalRolls += rollsUsed;
      subtotal += total;

      return { name: environment.name, height, width, area, rollsAuto, rollsManual, total };
    });

    const removalCost = removal_included ? normalizeNumber(removal_price) : 0;
    const totalAmount = subtotal + removalCost;

    await db.query('BEGIN');

    const budgetResult = await db.query(
      `
        INSERT INTO budgets (
          user_id, client_id, status, total_rolls, total_area, subtotal_rolls, removal_cost, total_amount
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [req.userId, client_id, totalRolls, totalArea, subtotal, removalCost, totalAmount]
    );

    const budget = budgetResult.rows[0];

    for (const environment of computedEnvironments) {
      await db.query(
        `
          INSERT INTO environments (
            budget_id, name, height, width, area, rolls_auto, rolls_manual, price_per_roll, total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          budget.id,
          environment.name,
          environment.height,
          environment.width,
          environment.area,
          environment.rollsAuto,
          environment.rollsManual,
          cleanPricePerRoll,
          environment.total,
        ]
      );
    }

    await db.query('COMMIT');
    return res.status(201).json(budget);
  } catch (_error) {
    await db.query('ROLLBACK');
    return res.status(500).json({ error: 'Erro ao criar orcamento.' });
  } finally {
    db.release();
  }
};

exports.getBudgets = async (req, res) => {
  try {
    if (req.query.summary === 'true') {
      const { rows } = await pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status = 'approved')::int AS total_approved,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS total_pending,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) AS total_revenue
          FROM budgets
          WHERE user_id = $1
        `,
        [req.userId]
      );

      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `
        SELECT b.*, c.name AS client_name
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar orcamentos.' });
  }
};

exports.getBudget = async (req, res) => {
  try {
    const budgetResult = await pool.query(
      `
        SELECT b.*, c.name AS client_name, c.phone, c.email, c.address
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.id = $1 AND b.user_id = $2
      `,
      [req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orcamento nao encontrado.' });
    }

    const environmentsResult = await pool.query(
      `
        SELECT *
        FROM environments
        WHERE budget_id = $1
        ORDER BY id ASC
      `,
      [req.params.id]
    );

    return res.json({ ...budget, environments: environmentsResult.rows });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar orcamento.' });
  }
};

exports.approveBudget = async (req, res) => {
  const db = await pool.connect();

  try {
    const { schedule_date } = req.body;

    await db.query('BEGIN');

    const budgetResult = await db.query(
      `
        UPDATE budgets
        SET status = 'approved', schedule_date = COALESCE($1, schedule_date), approved_date = NOW(), updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [schedule_date || null, req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Orcamento nao encontrado.' });
    }

    let schedule = null;

    if (schedule_date) {
      const clientResult = await db.query('SELECT name FROM clients WHERE id = $1 AND user_id = $2', [budget.client_id, req.userId]);
      const client = clientResult.rows[0];

      const scheduleResult = await db.query(
        `
          INSERT INTO schedules (user_id, budget_id, client_id, title, description, date, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
          RETURNING *
        `,
        [
          req.userId,
          budget.id,
          budget.client_id,
          `Instalacao - ${client ? client.name : 'Cliente'}`,
          `Orcamento #${budget.id} aprovado.`,
          schedule_date,
        ]
      );

      schedule = scheduleResult.rows[0];
    }

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [req.userId, 'Orcamento aprovado', `O orcamento #${budget.id} foi aprovado.`]
    );

    await db.query('COMMIT');
    return res.json({ budget, schedule });
  } catch (_error) {
    await db.query('ROLLBACK');
    return res.status(500).json({ error: 'Erro ao aprovar orcamento.' });
  } finally {
    db.release();
  }
};

exports.rejectBudget = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        UPDATE budgets
        SET status = 'rejected', updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Orcamento nao encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao rejeitar orcamento.' });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const budgetResult = await pool.query(`SELECT * FROM budgets WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orcamento nao encontrado.' });
    }

    const clientResult = await pool.query(`SELECT * FROM clients WHERE id = $1 AND user_id = $2`, [budget.client_id, req.userId]);
    const userResult = await pool.query(`SELECT id, name, email, phone, logo FROM users WHERE id = $1`, [req.userId]);
    const environmentsResult = await pool.query(`SELECT * FROM environments WHERE budget_id = $1 ORDER BY id`, [budget.id]);

    const filePath = await generateBudgetPDF({
      budget,
      client: clientResult.rows[0],
      environments: environmentsResult.rows,
      user: userResult.rows[0],
    });

    return res.download(filePath, `orcamento-${budget.id}.pdf`, async () => {
      await fs.unlink(filePath).catch(() => null);
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao gerar PDF.' });
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const budgetResult = await pool.query(
      `
        SELECT b.*, c.name AS client_name, c.phone
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.id = $1 AND b.user_id = $2
      `,
      [req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orcamento nao encontrado.' });
    }

    const link = generateWhatsAppLink(
      budget.phone,
      `Ola ${budget.client_name}, seu orcamento #${budget.id} ficou em R$ ${Number(budget.total_amount || 0).toFixed(2)}.`
    );

    return res.json({ link });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao gerar link do WhatsApp.' });
  }
};
'@

Write-ProjectFile 'backend/routes/authRoutes.js' @'
const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.get('/2fa/setup', auth, controller.setup2FA);
router.post('/2fa/enable', auth, controller.enable2FA);
router.post('/2fa/disable', auth, controller.disable2FA);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/userRoutes.js' @'
const express = require('express');
const controller = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/clientRoutes.js' @'
const express = require('express');
const controller = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.post('/', controller.createClient);
router.get('/', controller.getClients);
router.get('/:id', controller.getClient);
router.put('/:id', controller.updateClient);
router.delete('/:id', controller.deleteClient);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/budgetRoutes.js' @'
const express = require('express');
const controller = require('../controllers/budgetController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.post('/', controller.createBudget);
router.get('/', controller.getBudgets);
router.get('/:id', controller.getBudget);
router.put('/:id/approve', controller.approveBudget);
router.put('/:id/reject', controller.rejectBudget);
router.get('/:id/pdf', controller.generatePDF);
router.get('/:id/whatsapp', controller.sendWhatsApp);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/subscriptionRoutes.js' @'
const express = require('express');
const controller = require('../controllers/subscriptionController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.use(auth);
router.get('/', controller.getSubscription);
router.post('/pay', controller.createPayment);
router.get('/payment/:externalId', controller.checkPayment);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/scheduleRoutes.js' @'
const express = require('express');
const controller = require('../controllers/scheduleController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.get('/', controller.getSchedules);
router.put('/:id/status', controller.updateScheduleStatus);
router.delete('/:id', controller.deleteSchedule);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/notificationRoutes.js' @'
const express = require('express');
const controller = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.get('/', controller.getNotifications);
router.put('/:id/read', controller.markAsRead);

module.exports = router;
'@

Write-ProjectFile 'backend/routes/paymentRoutes.js' @'
const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  return res.json({ message: 'Use /api/subscriptions/pay para gerar pagamentos.' });
});

module.exports = router;
'@

Write-ProjectFile 'backend/server.js' @'
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bem-instalado-backend', date: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`Bem Instalado backend rodando na porta ${port}`);
});
'@

Write-ProjectFile 'backend/db/schema.sql' @'
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  logo TEXT,
  default_price_per_roll NUMERIC(10, 2) DEFAULT 0,
  default_removal_price NUMERIC(10, 2) DEFAULT 0,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  total_rolls INTEGER DEFAULT 0,
  total_area NUMERIC(10, 2) DEFAULT 0,
  subtotal_rolls NUMERIC(10, 2) DEFAULT 0,
  removal_cost NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  approved_date TIMESTAMP,
  schedule_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  height NUMERIC(10, 2) NOT NULL,
  width NUMERIC(10, 2) NOT NULL,
  area NUMERIC(10, 2) DEFAULT 0,
  rolls_auto INTEGER DEFAULT 0,
  rolls_manual INTEGER,
  price_per_roll NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(30) NOT NULL DEFAULT 'monthly',
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  external_id VARCHAR(120) UNIQUE,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_id INTEGER REFERENCES budgets(id) ON DELETE SET NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
'@

$modelFiles = @(
  'backend/models/User.js',
  'backend/models/Client.js',
  'backend/models/Budget.js',
  'backend/models/Environment.js',
  'backend/models/Subscription.js',
  'backend/models/Payment.js',
  'backend/models/Schedule.js',
  'backend/models/Notification.js'
)

foreach ($file in $modelFiles) {
  Write-ProjectFile $file @'
module.exports = {};
'@
}
# __FRONTEND_PART1__
Write-ProjectFile 'frontend/package.json' @'
{
  "name": "bem-instalado-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "axios": "^1.7.7",
    "date-fns": "^4.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hot-toast": "^2.4.1",
    "react-router-dom": "^6.28.0",
    "react-scripts": "5.0.1"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
'@

Write-ProjectFile 'frontend/.env.example' @'
REACT_APP_API_URL=http://localhost:5000/api
'@

Write-ProjectFile 'frontend/tailwind.config.js' @'
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
'@

Write-ProjectFile 'frontend/postcss.config.js' @'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@

Write-ProjectFile 'frontend/public/index.html' @'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#1f2937" />
    <title>Bem Instalado</title>
  </head>
  <body>
    <noscript>Voce precisa habilitar JavaScript para usar este sistema.</noscript>
    <div id="root"></div>
  </body>
</html>
'@

Write-ProjectFile 'frontend/src/index.css' @'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  color: #111827;
}

a {
  color: inherit;
  text-decoration: none;
}
'@

Write-ProjectFile 'frontend/src/index.js' @'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
        <Toaster position="top-right" />
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
);
'@

Write-ProjectFile 'frontend/src/services/api.js' @'
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
'@

Write-ProjectFile 'frontend/src/services/auth.js' @'
import api from './api';

export async function loginRequest(payload) {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

export async function registerRequest(payload) {
  const response = await api.post('/auth/register', payload);
  return response.data;
}

export async function getProfileRequest() {
  const response = await api.get('/users/profile');
  return response.data;
}
'@

Write-ProjectFile 'frontend/src/contexts/AuthContext.js' @'
import { createContext, useContext, useEffect, useState } from 'react';
import { getProfileRequest, loginRequest, registerRequest } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    getProfileRequest()
      .then((profile) => setUser(profile))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const result = await loginRequest(payload);
    localStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    localStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
'@

Write-ProjectFile 'frontend/src/contexts/NotificationContext.js' @'
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (_error) {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();

    if (!user) {
      return undefined;
    }

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, refreshNotifications: loadNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
'@

Write-ProjectFile 'frontend/src/components/Layout/ProtectedRoute.js' @'
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return user ? <Outlet /> : <Navigate replace to="/login" />;
}
'@

Write-ProjectFile 'frontend/src/components/Layout/Sidebar.js' @'
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clients', label: 'Clientes' },
  { to: '/budgets', label: 'Orcamentos' },
  { to: '/budgets/new', label: 'Novo orcamento' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/profile', label: 'Perfil' },
  { to: '/subscription', label: 'Assinatura' },
  { to: '/notifications', label: 'Notificacoes' },
];

export default function Sidebar() {
  return (
    <aside className="w-full bg-slate-900 p-4 text-white md:w-64">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bem Instalado</h1>
        <p className="text-sm text-slate-300">Base executavel do SaaS</p>
      </div>

      <nav className="flex flex-col gap-2">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded px-3 py-2 ${isActive ? 'bg-emerald-600' : 'hover:bg-slate-800'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Layout/Header.js' @'
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div>
        <h2 className="text-lg font-semibold">Painel</h2>
        <p className="text-sm text-slate-500">{user ? `Ola, ${user.name}` : 'Sem sessao'}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="rounded bg-slate-100 px-3 py-1 text-sm">Notificacoes: {unread}</span>
        <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={logout} type="button">
          Sair
        </button>
      </div>
    </header>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Layout/Layout.js' @'
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />

      <div className="flex-1">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Auth/Login.js' @'
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', twoFactorToken: '' });
  const [needs2FA, setNeeds2FA] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const result = await login(form);

      if (result.twoFactorRequired) {
        setNeeds2FA(true);
        return;
      }

      toast.success('Login realizado com sucesso.');
      navigate('/dashboard');
    } catch (error) {
      const status = error.response?.status;

      if (status === 401 && error.response?.data?.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Informe o codigo 2FA.');
        return;
      }

      toast.error(error.response?.data?.error || 'Nao foi possivel entrar.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-md rounded bg-white p-6 shadow" onSubmit={handleSubmit}>
        <h1 className="mb-4 text-2xl font-bold">Entrar</h1>
        <input className="mb-3 w-full rounded border px-3 py-2" name="email" onChange={handleChange} placeholder="Email" type="email" value={form.email} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="password" onChange={handleChange} placeholder="Senha" type="password" value={form.password} />
        {needs2FA && (
          <input className="mb-3 w-full rounded border px-3 py-2" name="twoFactorToken" onChange={handleChange} placeholder="Codigo 2FA" value={form.twoFactorToken} />
        )}
        <button className="w-full rounded bg-emerald-600 px-4 py-2 text-white" type="submit">Entrar</button>
        <p className="mt-4 text-sm text-slate-600">
          Ainda nao tem conta? <Link className="text-emerald-700" to="/register">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Auth/Register.js' @'
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await register(form);
      toast.success('Cadastro realizado com sucesso.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel cadastrar.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-md rounded bg-white p-6 shadow" onSubmit={handleSubmit}>
        <h1 className="mb-4 text-2xl font-bold">Criar conta</h1>
        <input className="mb-3 w-full rounded border px-3 py-2" name="name" onChange={handleChange} placeholder="Nome" value={form.name} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="email" onChange={handleChange} placeholder="Email" type="email" value={form.email} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="password" onChange={handleChange} placeholder="Senha" type="password" value={form.password} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="phone" onChange={handleChange} placeholder="Telefone" value={form.phone} />
        <button className="w-full rounded bg-emerald-600 px-4 py-2 text-white" type="submit">Cadastrar</button>
        <p className="mt-4 text-sm text-slate-600">
          Ja tem conta? <Link className="text-emerald-700" to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Dashboard/Dashboard.js' @'
import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Dashboard() {
  const [summary, setSummary] = useState({ total_approved: 0, total_pending: 0, total_revenue: 0 });

  useEffect(() => {
    api.get('/budgets?summary=true').then((response) => setSummary(response.data)).catch(() => null);
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-500">Resumo rapido do negocio.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Aprovados</p>
          <p className="mt-2 text-3xl font-bold">{summary.total_approved}</p>
        </article>
        <article className="rounded bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Pendentes</p>
          <p className="mt-2 text-3xl font-bold">{summary.total_pending}</p>
        </article>
        <article className="rounded bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Receita aprovada</p>
          <p className="mt-2 text-3xl font-bold">R$ {Number(summary.total_revenue || 0).toFixed(2)}</p>
        </article>
      </div>
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Clients/Clients.js' @'
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const initialForm = { name: '', phone: '', email: '', address: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(initialForm);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar clientes.');
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.post('/clients', form);
      setForm(initialForm);
      toast.success('Cliente cadastrado.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel salvar o cliente.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Cliente removido.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel remover o cliente.');
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <form className="rounded bg-white p-5 shadow" onSubmit={handleSubmit}>
        <h1 className="mb-4 text-xl font-bold">Novo cliente</h1>
        <input className="mb-3 w-full rounded border px-3 py-2" name="name" onChange={handleChange} placeholder="Nome" value={form.name} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="phone" onChange={handleChange} placeholder="Telefone" value={form.phone} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="email" onChange={handleChange} placeholder="Email" value={form.email} />
        <textarea className="mb-3 w-full rounded border px-3 py-2" name="address" onChange={handleChange} placeholder="Endereco" rows="3" value={form.address} />
        <button className="w-full rounded bg-emerald-600 px-4 py-2 text-white" type="submit">Salvar cliente</button>
      </form>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Clientes</h2>
          <p className="text-slate-500">Lista rapida com acoes basicas.</p>
        </div>

        {clients.map((client) => (
          <article className="rounded bg-white p-4 shadow" key={client.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{client.name}</h3>
                <p className="text-sm text-slate-600">{client.phone}</p>
                <p className="text-sm text-slate-500">{client.email || 'Sem email'}</p>
              </div>
              <button className="rounded bg-red-600 px-3 py-2 text-sm text-white" onClick={() => handleDelete(client.id)} type="button">
                Excluir
              </button>
            </div>
          </article>
        ))}

        {clients.length === 0 && <p className="rounded bg-white p-4 shadow">Nenhum cliente cadastrado.</p>}
      </div>
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Clients/ClientForm.js' @'
export default function ClientForm() {
  return null;
}
'@
# __FRONTEND_PART2__
Write-ProjectFile 'frontend/src/components/Budgets/Budgets.js' @'
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);

  const loadBudgets = async () => {
    try {
      const response = await api.get('/budgets');
      setBudgets(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar orcamentos.');
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const approveBudget = async (budgetId) => {
    const scheduleDate = window.prompt('Data e hora do agendamento (YYYY-MM-DD HH:mm:ss)');
    if (!scheduleDate) return;

    try {
      await api.put(`/budgets/${budgetId}/approve`, { schedule_date: scheduleDate });
      toast.success('Orcamento aprovado.');
      loadBudgets();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel aprovar o orcamento.');
    }
  };

  const rejectBudget = async (budgetId) => {
    try {
      await api.put(`/budgets/${budgetId}/reject`);
      toast.success('Orcamento rejeitado.');
      loadBudgets();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel rejeitar o orcamento.');
    }
  };

  const openWhatsapp = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/whatsapp`);
      window.open(response.data.link, '_blank');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel abrir o WhatsApp.');
    }
  };

  const downloadPdf = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orcamento-${budgetId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel gerar o PDF.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orcamentos</h1>
          <p className="text-slate-500">Lista principal de propostas.</p>
        </div>
        <Link className="rounded bg-emerald-600 px-4 py-2 text-white" to="/budgets/new">Novo orcamento</Link>
      </div>

      <div className="space-y-3">
        {budgets.map((budget) => (
          <article className="rounded bg-white p-4 shadow" key={budget.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">#{budget.id} - {budget.client_name}</h2>
                <p className="text-sm text-slate-600">Status: {budget.status}</p>
                <p className="text-sm text-slate-600">Total: R$ {Number(budget.total_amount || 0).toFixed(2)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {budget.status === 'pending' && (
                  <>
                    <button className="rounded bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => approveBudget(budget.id)} type="button">Aprovar</button>
                    <button className="rounded bg-red-600 px-3 py-2 text-sm text-white" onClick={() => rejectBudget(budget.id)} type="button">Rejeitar</button>
                  </>
                )}
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => downloadPdf(budget.id)} type="button">PDF</button>
                <button className="rounded bg-sky-600 px-3 py-2 text-sm text-white" onClick={() => openWhatsapp(budget.id)} type="button">WhatsApp</button>
              </div>
            </div>
          </article>
        ))}

        {budgets.length === 0 && <p className="rounded bg-white p-4 shadow">Nenhum orcamento cadastrado.</p>}
      </div>
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Budgets/BudgetForm.js' @'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const initialEnvironment = { name: '', height: '', width: '', rolls_manual: '' };

export default function BudgetForm() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [pricePerRoll, setPricePerRoll] = useState(0);
  const [removalIncluded, setRemovalIncluded] = useState(false);
  const [removalPrice, setRemovalPrice] = useState(0);
  const [environments, setEnvironments] = useState([initialEnvironment]);

  useEffect(() => {
    api.get('/clients').then((response) => setClients(response.data)).catch(() => null);
    api.get('/users/profile')
      .then((response) => {
        setPricePerRoll(Number(response.data.default_price_per_roll || 0));
        setRemovalPrice(Number(response.data.default_removal_price || 0));
      })
      .catch(() => null);
  }, []);

  const updateEnvironment = (index, field, value) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const addEnvironment = () => {
    setEnvironments((current) => [...current, initialEnvironment]);
  };

  const removeEnvironment = (index) => {
    setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.post('/budgets', {
        client_id: clientId,
        price_per_roll: Number(pricePerRoll),
        removal_included: removalIncluded,
        removal_price: Number(removalPrice),
        environments: environments.map((environment) => ({
          ...environment,
          height: Number(environment.height),
          width: Number(environment.width),
          rolls_manual: environment.rolls_manual ? Number(environment.rolls_manual) : null,
        })),
      });

      toast.success('Orcamento criado.');
      navigate('/budgets');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel criar o orcamento.');
    }
  };

  return (
    <section className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Novo orcamento</h1>
        <p className="text-slate-500">Formulario simplificado com multiplos ambientes.</p>
      </div>

      <form className="rounded bg-white p-5 shadow" onSubmit={handleSubmit}>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm">Cliente</span>
          <select className="w-full rounded border px-3 py-2" onChange={(event) => setClientId(event.target.value)} value={clientId}>
            <option value="">Selecione um cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </label>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <input className="w-full rounded border px-3 py-2" onChange={(event) => setPricePerRoll(event.target.value)} placeholder="Preco por rolo" type="number" value={pricePerRoll} />
          <input className="w-full rounded border px-3 py-2" onChange={(event) => setRemovalPrice(event.target.value)} placeholder="Preco remocao" type="number" value={removalPrice} />
        </div>

        <label className="mb-4 flex items-center gap-2">
          <input checked={removalIncluded} onChange={(event) => setRemovalIncluded(event.target.checked)} type="checkbox" />
          <span>Incluir remocao</span>
        </label>

        <div className="space-y-4">
          {environments.map((environment, index) => (
            <div className="rounded border p-4" key={`env-${index}`}>
              <div className="mb-3 flex items-center justify-between">
                <strong>Ambiente {index + 1}</strong>
                {environments.length > 1 && (
                  <button className="text-sm text-red-600" onClick={() => removeEnvironment(index)} type="button">Remover</button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded border px-3 py-2" onChange={(event) => updateEnvironment(index, 'name', event.target.value)} placeholder="Nome do ambiente" value={environment.name} />
                <input className="rounded border px-3 py-2" onChange={(event) => updateEnvironment(index, 'height', event.target.value)} placeholder="Altura" type="number" value={environment.height} />
                <input className="rounded border px-3 py-2" onChange={(event) => updateEnvironment(index, 'width', event.target.value)} placeholder="Largura" type="number" value={environment.width} />
                <input className="rounded border px-3 py-2" onChange={(event) => updateEnvironment(index, 'rolls_manual', event.target.value)} placeholder="Rolos manuais (opcional)" type="number" value={environment.rolls_manual} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded border px-4 py-2" onClick={addEnvironment} type="button">Adicionar ambiente</button>
          <button className="rounded bg-emerald-600 px-4 py-2 text-white" type="submit">Salvar orcamento</button>
        </div>
      </form>
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Agenda/Agenda.js' @'
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function Agenda() {
  const [items, setItems] = useState([]);

  const loadAgenda = async () => {
    try {
      const response = await api.get('/schedules');
      setItems(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar a agenda.');
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/schedules/${id}/status`, { status });
      toast.success('Agenda atualizada.');
      loadAgenda();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel atualizar a agenda.');
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-slate-500">Lista simples dos proximos eventos.</p>
      </div>

      {items.map((item) => (
        <article className="rounded bg-white p-4 shadow" key={item.id}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-slate-600">{new Date(item.date).toLocaleString()}</p>
              <p className="text-sm text-slate-500">Status: {item.status}</p>
            </div>

            <div className="flex gap-2">
              <button className="rounded bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus(item.id, 'completed')} type="button">Concluir</button>
              <button className="rounded bg-red-600 px-3 py-2 text-sm text-white" onClick={() => updateStatus(item.id, 'canceled')} type="button">Cancelar</button>
            </div>
          </div>
        </article>
      ))}

      {items.length === 0 && <p className="rounded bg-white p-4 shadow">Nenhum agendamento encontrado.</p>}
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Profile/Profile.js' @'
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function Profile() {
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    logo: '',
    default_price_per_roll: 0,
    default_removal_price: 0,
  });

  useEffect(() => {
    api.get('/users/profile').then((response) => setForm(response.data)).catch(() => null);
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await api.put('/users/profile', form);
      setUser(response.data);
      toast.success('Perfil atualizado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel atualizar o perfil.');
    }
  };

  return (
    <section className="max-w-2xl rounded bg-white p-5 shadow">
      <h1 className="mb-4 text-2xl font-bold">Perfil</h1>
      <form onSubmit={handleSubmit}>
        <input className="mb-3 w-full rounded border px-3 py-2" name="name" onChange={handleChange} placeholder="Nome" value={form.name || ''} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="phone" onChange={handleChange} placeholder="Telefone" value={form.phone || ''} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="logo" onChange={handleChange} placeholder="Logo (URL)" value={form.logo || ''} />
        <input className="mb-3 w-full rounded border px-3 py-2" name="default_price_per_roll" onChange={handleChange} placeholder="Preco por rolo" type="number" value={form.default_price_per_roll || 0} />
        <input className="mb-4 w-full rounded border px-3 py-2" name="default_removal_price" onChange={handleChange} placeholder="Preco remocao" type="number" value={form.default_removal_price || 0} />
        <button className="rounded bg-emerald-600 px-4 py-2 text-white" type="submit">Salvar</button>
      </form>
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Subscription/Subscription.js' @'
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function Subscription() {
  const [subscription, setSubscription] = useState(null);
  const [payment, setPayment] = useState(null);

  const loadSubscription = async () => {
    try {
      const response = await api.get('/subscriptions');
      setSubscription(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar a assinatura.');
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const handlePay = async () => {
    try {
      const response = await api.post('/subscriptions/pay');
      setPayment(response.data);
      toast.success('PIX gerado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel gerar o pagamento.');
    }
  };

  return (
    <section className="max-w-2xl space-y-4">
      <div className="rounded bg-white p-5 shadow">
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="mt-2 text-slate-600">Status atual: {subscription ? subscription.status : 'carregando...'}</p>
        <button className="mt-4 rounded bg-emerald-600 px-4 py-2 text-white" onClick={handlePay} type="button">Gerar PIX mensal</button>
      </div>

      {payment && (
        <div className="rounded bg-white p-5 shadow">
          <h2 className="font-semibold">PIX</h2>
          <p className="mt-2 break-all text-sm text-slate-600">{payment.copyPaste}</p>
          <p className="mt-3 text-sm text-slate-500">Depois de pagar, consulte GET /api/subscriptions/payment/{payment.payment.external_id}.</p>
        </div>
      )}
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/components/Notifications/Notifications.js' @'
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function Notifications() {
  const [items, setItems] = useState([]);

  const loadItems = async () => {
    try {
      const response = await api.get('/notifications');
      setItems(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar notificacoes.');
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      loadItems();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel atualizar notificacao.');
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Notificacoes</h1>
        <p className="text-slate-500">Avisos do sistema.</p>
      </div>

      {items.map((item) => (
        <article className="rounded bg-white p-4 shadow" key={item.id}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-slate-600">{item.message}</p>
            </div>
            {!item.read && (
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => markAsRead(item.id)} type="button">Marcar como lida</button>
            )}
          </div>
        </article>
      ))}

      {items.length === 0 && <p className="rounded bg-white p-4 shadow">Nenhuma notificacao.</p>}
    </section>
  );
}
'@

Write-ProjectFile 'frontend/src/App.js' @'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import Clients from './components/Clients/Clients';
import Budgets from './components/Budgets/Budgets';
import BudgetForm from './components/Budgets/BudgetForm';
import Agenda from './components/Agenda/Agenda';
import Profile from './components/Profile/Profile';
import Subscription from './components/Subscription/Subscription';
import Notifications from './components/Notifications/Notifications';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<Navigate replace to="/dashboard" />} path="/" />
            <Route element={<Dashboard />} path="/dashboard" />
            <Route element={<Clients />} path="/clients" />
            <Route element={<Budgets />} path="/budgets" />
            <Route element={<BudgetForm />} path="/budgets/new" />
            <Route element={<Agenda />} path="/agenda" />
            <Route element={<Profile />} path="/profile" />
            <Route element={<Subscription />} path="/subscription" />
            <Route element={<Notifications />} path="/notifications" />
          </Route>
        </Route>
        <Route element={<Login />} path="/login" />
        <Route element={<Register />} path="/register" />
      </Routes>
    </BrowserRouter>
  );
}
'@
# __FINALIZE__
Write-Host ""
Write-Host ("Projeto criado em: " + $projectRoot)
Write-Host "Passos sugeridos:"
Write-Host "1. Rode o schema em backend\db\schema.sql"
Write-Host "2. Ajuste backend\.env e frontend\.env"
Write-Host "3. Execute .\bem-instalado\start.ps1 -Install"

if ($Install) {
  Push-Location $projectRoot
  .\start.ps1 -Install
  Pop-Location
}

if ($Start -and -not $Install) {
  Push-Location $projectRoot
  .\start.ps1
  Pop-Location
}
