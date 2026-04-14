const fs = require('fs/promises');
const pool = require('../config/database');
const generateBudgetPDF = require('../utils/generatePDF');
const generateWhatsAppLink = require('../utils/whatsapp');

const ROLL_AREA = 4.5;

function normalizeNumber(value) {
  return Number(value || 0);
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'sim' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizePricingMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'square_meter' || normalized === 'm2') {
    return 'square_meter';
  }
  return 'roll';
}

function firstFilled(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function buildServiceLocation(client) {
  const street = normalizeString(client?.street);
  const number = normalizeString(client?.house_number);
  const neighborhood = normalizeString(client?.neighborhood);
  const city = normalizeString(client?.city);
  const state = normalizeString(client?.state);
  const zipCode = normalizeString(client?.zip_code);
  const reference = firstFilled(client?.address_reference, client?.address);

  const line1 = [street, number && `Nº ${number}`].filter(Boolean).join(', ');
  const line2 = [neighborhood, [city, state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const baseAddress = [line1, line2, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' • ');
  const fullAddress = firstFilled(baseAddress, client?.address, 'Endereço não informado');

  return {
    street: street || null,
    number: number || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    zipCode: zipCode || null,
    reference: reference || null,
    fullAddress,
  };
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function parseScheduleDateTime(value) {
  const raw = normalizeString(value).replace(' ', 'T');
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/);
  if (!match) {
    return null;
  }

  const datePart = match[1];
  const timePart = `${match[2]}${match[3] || ':00'}`;
  const parsed = new Date(`${datePart}T${timePart}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    parsed,
    dbTimestamp: `${datePart} ${timePart}`,
  };
}

exports.createBudget = async (req, res) => {
  const db = await pool.connect();
  let transactionStarted = false;

  try {
    const {
      client_id,
      environments,
      pricing_mode,
      price_per_roll,
      price_per_square_meter,
      installment_enabled,
      installments_count,
      removal_included,
      removal_price,
    } = req.body;
    const cleanClientId = Number(client_id);
    const cleanPricingMode = normalizePricingMode(pricing_mode);
    const cleanPricePerRoll = normalizeNumber(price_per_roll);
    const cleanPricePerSquareMeter = normalizeNumber(price_per_square_meter);
    const installmentsEnabled = normalizeBoolean(installment_enabled);
    const requestedInstallmentsCount = normalizeInteger(installments_count);
    const installmentsCount = installmentsEnabled ? requestedInstallmentsCount : 1;
    const legacyRemovalIncluded = normalizeBoolean(removal_included);
    const legacyRemovalPrice = removal_price === null || removal_price === undefined || String(removal_price).trim() === ''
      ? 0
      : Number(removal_price);

    if (!Number.isInteger(cleanClientId) || cleanClientId <= 0) {
      return res.status(400).json({ error: 'Cliente inválido.' });
    }

    if (!Array.isArray(environments) || environments.length === 0) {
      return res.status(400).json({ error: 'Cliente e ambientes são obrigatórios.' });
    }

    if (cleanPricingMode === 'roll' && !isPositiveNumber(cleanPricePerRoll)) {
      return res.status(400).json({ error: 'Preço por rolo deve ser maior que zero.' });
    }

    if (cleanPricingMode === 'square_meter' && !isPositiveNumber(cleanPricePerSquareMeter)) {
      return res.status(400).json({ error: 'Preço por metro quadrado deve ser maior que zero.' });
    }

    if (
      legacyRemovalIncluded &&
      (!Number.isFinite(legacyRemovalPrice) || legacyRemovalPrice < 0)
    ) {
      return res.status(400).json({ error: 'Preço de remoção legado inválido.' });
    }

    if (installmentsEnabled) {
      if (!Number.isInteger(installmentsCount) || installmentsCount < 2 || installmentsCount > 12) {
        return res.status(400).json({ error: 'Parcelamento deve ser entre 2x e 12x.' });
      }
    }

    const clientCheck = await db.query('SELECT id FROM clients WHERE id = $1 AND user_id = $2', [cleanClientId, req.userId]);

    if (!clientCheck.rowCount) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    let totalArea = 0;
    let totalRolls = 0;
    let subtotal = 0;
    let totalRemovalByEnvironment = 0;

    const computedEnvironments = environments.map((environment) => {
      const name = normalizeString(environment.name);
      const height = normalizeNumber(environment.height);
      const width = normalizeNumber(environment.width);
      const hasManualRolls = environment.rolls_manual !== null && environment.rolls_manual !== undefined && String(environment.rolls_manual).trim() !== '';
      const rollsManual = hasManualRolls ? Number(environment.rolls_manual) : null;
      const removalIncludedByEnvironment = normalizeBoolean(environment.removal_included);
      const removalPriceByEnvironmentRaw =
        environment.removal_price === null ||
        environment.removal_price === undefined ||
        String(environment.removal_price).trim() === ''
          ? 0
          : Number(environment.removal_price);

      if (!name) {
        throw new Error('VALIDATION_ENV_NAME');
      }

      if (!isPositiveNumber(height) || !isPositiveNumber(width)) {
        throw new Error('VALIDATION_ENV_SIZE');
      }

      if (hasManualRolls && (!Number.isInteger(rollsManual) || rollsManual <= 0)) {
        throw new Error('VALIDATION_ENV_ROLLS');
      }

      if (
        removalIncludedByEnvironment &&
        (!Number.isFinite(removalPriceByEnvironmentRaw) || removalPriceByEnvironmentRaw < 0)
      ) {
        throw new Error('VALIDATION_ENV_REMOVAL');
      }

      const area = height * width;
      const rollsAuto = Math.ceil(area / ROLL_AREA);
      const rollsUsed = rollsManual || rollsAuto;
      const subtotalByEnvironment = cleanPricingMode === 'square_meter'
        ? area * cleanPricePerSquareMeter
        : rollsUsed * cleanPricePerRoll;
      const removalTotalByEnvironment = removalIncludedByEnvironment ? removalPriceByEnvironmentRaw : 0;
      const total = subtotalByEnvironment + removalTotalByEnvironment;

      totalArea += area;
      totalRolls += rollsUsed;
      subtotal += subtotalByEnvironment;
      totalRemovalByEnvironment += removalTotalByEnvironment;

      return {
        name,
        height,
        width,
        area,
        rollsAuto,
        rollsManual,
        pricePerSquareMeter: cleanPricingMode === 'square_meter' ? cleanPricePerSquareMeter : 0,
        pricePerRoll: cleanPricingMode === 'roll' ? cleanPricePerRoll : 0,
        removalIncluded: removalIncludedByEnvironment,
        removalPrice: removalTotalByEnvironment,
        removalTotal: removalTotalByEnvironment,
        total,
      };
    });

    const hasEnvironmentRemoval = computedEnvironments.some((environment) => environment.removalIncluded);
    const fallbackLegacyRemoval = legacyRemovalIncluded ? legacyRemovalPrice : 0;

    if (!hasEnvironmentRemoval && fallbackLegacyRemoval > 0 && computedEnvironments.length > 0) {
      computedEnvironments[0].removalIncluded = true;
      computedEnvironments[0].removalPrice = fallbackLegacyRemoval;
      computedEnvironments[0].removalTotal = fallbackLegacyRemoval;
      computedEnvironments[0].total += fallbackLegacyRemoval;
      totalRemovalByEnvironment = fallbackLegacyRemoval;
    }

    const removalCost = totalRemovalByEnvironment;
    const totalAmount = subtotal + removalCost;

    await db.query('BEGIN');
    transactionStarted = true;

    const budgetResult = await db.query(
      `
        INSERT INTO budgets (
          user_id,
          client_id,
          status,
          pricing_mode,
          price_per_roll,
          price_per_square_meter,
          total_rolls,
          total_area,
          subtotal_rolls,
          removal_cost,
          total_amount,
          installment_enabled,
          installments_count
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        req.userId,
        cleanClientId,
        cleanPricingMode,
        cleanPricingMode === 'roll' ? cleanPricePerRoll : 0,
        cleanPricingMode === 'square_meter' ? cleanPricePerSquareMeter : 0,
        totalRolls,
        totalArea,
        subtotal,
        removalCost,
        totalAmount,
        installmentsEnabled,
        installmentsEnabled ? installmentsCount : 1,
      ]
    );

    const budget = budgetResult.rows[0];

    for (const environment of computedEnvironments) {
      await db.query(
        `
          INSERT INTO environments (
            budget_id,
            name,
            height,
            width,
            area,
            rolls_auto,
            rolls_manual,
            price_per_square_meter,
            removal_included,
            removal_price,
            removal_total,
            price_per_roll,
            total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          budget.id,
          environment.name,
          environment.height,
          environment.width,
          environment.area,
          environment.rollsAuto,
          environment.rollsManual,
          environment.pricePerSquareMeter,
          environment.removalIncluded,
          environment.removalPrice,
          environment.removalTotal,
          environment.pricePerRoll,
          environment.total,
        ]
      );
    }

    await db.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json(budget);
  } catch (error) {
    if (transactionStarted) {
      await db.query('ROLLBACK');
    }

    if (error?.message === 'VALIDATION_ENV_NAME') {
      return res.status(400).json({ error: 'Cada ambiente precisa ter um nome.' });
    }

    if (error?.message === 'VALIDATION_ENV_SIZE') {
      return res.status(400).json({ error: 'Altura e largura devem ser maiores que zero.' });
    }

    if (error?.message === 'VALIDATION_ENV_ROLLS') {
      return res.status(400).json({ error: 'Rolos manuais devem ser um número inteiro positivo.' });
    }

    if (error?.message === 'VALIDATION_ENV_REMOVAL') {
      return res.status(400).json({ error: 'Remoção por ambiente precisa ser um valor válido e não negativo.' });
    }

    return res.status(500).json({ error: 'Erro ao criar orçamento.' });
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
    return res.status(500).json({ error: 'Erro ao listar orçamentos.' });
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
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
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
    return res.status(500).json({ error: 'Erro ao buscar orçamento.' });
  }
};

exports.approveBudget = async (req, res) => {
  const db = await pool.connect();
  let transactionStarted = false;

  try {
    const { schedule_date } = req.body;
    const parsedScheduleDate = schedule_date ? parseScheduleDateTime(schedule_date) : null;

    if (schedule_date && !parsedScheduleDate) {
      return res.status(400).json({ error: 'Data de agendamento inválida.' });
    }

    await db.query('BEGIN');
    transactionStarted = true;

    const budgetResult = await db.query(
      `
        UPDATE budgets
        SET status = 'approved', schedule_date = COALESCE($1, schedule_date), approved_date = NOW(), updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [parsedScheduleDate ? parsedScheduleDate.dbTimestamp : null, req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    let schedule = null;

    if (parsedScheduleDate) {
      const clientResult = await db.query(
        `
          SELECT
            name,
            address,
            street,
            house_number,
            neighborhood,
            city,
            state,
            zip_code,
            address_reference
          FROM clients
          WHERE id = $1 AND user_id = $2
        `,
        [budget.client_id, req.userId]
      );
      const client = clientResult.rows[0];
      const location = buildServiceLocation(client);
      const existingScheduleResult = await db.query(
        `
          SELECT id
          FROM schedules
          WHERE budget_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [budget.id, req.userId]
      );

      if (existingScheduleResult.rows[0]) {
        const scheduleResult = await db.query(
          `
            UPDATE schedules
            SET
              title = $1,
              description = $2,
              date = $3,
              status = 'scheduled',
              service_street = $4,
              service_number = $5,
              service_neighborhood = $6,
              service_city = $7,
              service_state = $8,
              service_zip_code = $9,
              service_reference = $10,
              service_full_address = $11,
              updated_at = NOW()
            WHERE id = $12
            RETURNING *
          `,
          [
              `Instalação - ${client ? client.name : 'Cliente'}`,
              `Orçamento #${budget.id} aprovado. Endereço: ${location.fullAddress}.`,
              parsedScheduleDate.dbTimestamp,
            location.street,
            location.number,
            location.neighborhood,
            location.city,
            location.state,
            location.zipCode,
            location.reference,
            location.fullAddress,
            existingScheduleResult.rows[0].id,
          ]
        );

        schedule = scheduleResult.rows[0];
      } else {
        const scheduleResult = await db.query(
          `
            INSERT INTO schedules (
              user_id,
              budget_id,
              client_id,
              title,
              description,
              date,
              status,
              service_street,
              service_number,
              service_neighborhood,
              service_city,
              service_state,
              service_zip_code,
              service_reference,
              service_full_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
          `,
          [
            req.userId,
            budget.id,
            budget.client_id,
              `Instalação - ${client ? client.name : 'Cliente'}`,
              `Orçamento #${budget.id} aprovado. Endereço: ${location.fullAddress}.`,
              parsedScheduleDate.dbTimestamp,
            location.street,
            location.number,
            location.neighborhood,
            location.city,
            location.state,
            location.zipCode,
            location.reference,
            location.fullAddress,
          ]
        );

        schedule = scheduleResult.rows[0];
      }
    }

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [req.userId, 'Orçamento aprovado', `O orçamento #${budget.id} foi aprovado.`]
    );

    await db.query('COMMIT');
    transactionStarted = false;
    return res.json({ budget, schedule });
  } catch (_error) {
    if (transactionStarted) {
      await db.query('ROLLBACK');
    }
    return res.status(500).json({ error: 'Erro ao aprovar orçamento.' });
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
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao rejeitar orçamento.' });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const budgetResult = await pool.query(`SELECT * FROM budgets WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    const clientResult = await pool.query(`SELECT * FROM clients WHERE id = $1 AND user_id = $2`, [budget.client_id, req.userId]);
    const userResult = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          phone,
          logo,
          installer_photo
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );
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
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    const installmentsEnabled = Boolean(budget.installment_enabled);
    const installmentsCount = Number(budget.installments_count || 1);
    const installmentText = installmentsEnabled && installmentsCount > 1
      ? ` Parcelamento disponível: ${installmentsCount}x de R$ ${(Number(budget.total_amount || 0) / installmentsCount).toFixed(2)}.`
      : '';

    const link = generateWhatsAppLink(
      budget.phone,
      `Olá ${budget.client_name}, seu orçamento #${budget.id} ficou em R$ ${Number(budget.total_amount || 0).toFixed(2)}.${installmentText}`
    );

    return res.json({ link });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao gerar link do WhatsApp.' });
  }
};
