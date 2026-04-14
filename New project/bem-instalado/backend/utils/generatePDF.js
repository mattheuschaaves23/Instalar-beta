const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COLORS = {
  bg: '#0F0D09',
  panel: '#18140D',
  panelSoft: '#14110B',
  border: '#3A2F1A',
  line: '#2B2315',
  gold: '#CDA349',
  goldSoft: '#F0D28A',
  text: '#F7F0E0',
  muted: '#B8A983',
  success: '#27B07D',
  danger: '#D15454',
  warning: '#D1A545',
};

const MARGIN = 40;
const BOTTOM_SAFE_AREA = 72;
const HEADER_HEIGHT = 124;

function toNumber(value) {
  return Number(value || 0);
}

function toText(value) {
  return String(value || '').trim();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function addDays(value, amount) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setDate(date.getDate() + amount);
  return date;
}

function statusLabel(status) {
  const normalized = toText(status).toLowerCase();
  if (normalized === 'approved') return 'Aprovado';
  if (normalized === 'rejected') return 'Rejeitado';
  if (normalized === 'pending') return 'Pendente';
  if (normalized === 'completed') return 'Concluído';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Pendente';
}

function statusColor(status) {
  const normalized = toText(status).toLowerCase();
  if (normalized === 'approved' || normalized === 'completed') return COLORS.success;
  if (normalized === 'rejected' || normalized === 'canceled') return COLORS.danger;
  return COLORS.warning;
}

function decodeImage(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (value.startsWith('data:image/')) {
    const base64 = value.split(',')[1];
    if (!base64) {
      return null;
    }
    try {
      return Buffer.from(base64, 'base64');
    } catch (_error) {
      return null;
    }
  }

  if (fs.existsSync(value)) {
    return value;
  }

  return null;
}

function installmentInfo(budget) {
  const enabled = Boolean(budget?.installment_enabled);
  const count = Number(budget?.installments_count || 1);
  const normalizedCount = enabled && count >= 2 ? Math.min(count, 12) : 1;
  const total = toNumber(budget?.total_amount);
  const installmentValue = normalizedCount > 1 ? total / normalizedCount : total;

  return {
    enabled: normalizedCount > 1,
    count: normalizedCount,
    installmentValue,
  };
}

function buildClientAddress(client) {
  const line1 = [toText(client?.street), toText(client?.house_number) && `Nº ${toText(client?.house_number)}`]
    .filter(Boolean)
    .join(', ');
  const line2 = [toText(client?.neighborhood), [toText(client?.city), toText(client?.state)].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ');
  const line3 = toText(client?.zip_code) ? `CEP ${toText(client?.zip_code)}` : '';
  const fallback = toText(client?.address);

  return [line1, line2, line3].filter(Boolean).join(' • ') || fallback || '-';
}

function canFit(doc, y, heightNeeded) {
  return y + heightNeeded <= doc.page.height - BOTTOM_SAFE_AREA;
}

function drawMainHeader(doc, budget, user) {
  const pageWidth = doc.page.width;
  const logo = decodeImage(user.logo);
  const photo = decodeImage(user.installer_photo);

  doc.save();
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT).fill(COLORS.bg);
  doc.restore();

  doc.save();
  doc.moveTo(MARGIN, HEADER_HEIGHT - 1).lineTo(pageWidth - MARGIN, HEADER_HEIGHT - 1).lineWidth(1).stroke(COLORS.border);
  doc.restore();

  let leftX = MARGIN;

  if (logo) {
    try {
      doc.image(logo, MARGIN, 20, { fit: [74, 74], align: 'left', valign: 'center' });
      leftX = MARGIN + 86;
    } catch (_error) {
      leftX = MARGIN;
    }
  }

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(19).text('Bem Instalado', leftX, 28);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text('Proposta comercial de instalação', leftX, 52);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text('Documento profissional para apresentação e fechamento.', leftX, 70);

  const rightBlockWidth = 232;
  const rightX = pageWidth - MARGIN - rightBlockWidth - (photo ? 60 : 0);
  const badgeText = statusLabel(budget.status);
  const badgeWidth = 88;
  const badgeX = rightX + rightBlockWidth - badgeWidth;
  const badgeY = 20;

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(`ORÇAMENTO #${budget.id}`, rightX, 34, {
    width: rightBlockWidth,
    align: 'right',
  });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(`Emissão: ${formatDate(new Date())}`, rightX, 52, {
    width: rightBlockWidth,
    align: 'right',
  });

  doc.save();
  doc.roundedRect(badgeX, badgeY, badgeWidth, 22, 11).fillAndStroke(COLORS.panel, statusColor(budget.status));
  doc.restore();
  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(badgeText.toUpperCase(), badgeX, badgeY + 7, {
    width: badgeWidth,
    align: 'center',
  });

  if (photo) {
    try {
      const photoX = pageWidth - MARGIN - 48;
      const photoY = 20;
      doc.image(photo, photoX, photoY, { fit: [48, 48], align: 'center', valign: 'center' });
      doc.roundedRect(photoX, photoY, 48, 48, 10).lineWidth(1).stroke(COLORS.border);
    } catch (_error) {
      // ignora falha de imagem
    }
  }
}

function drawSubHeader(doc, budget) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 56).fill(COLORS.bg);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(13).text(`Orçamento #${budget.id}`, MARGIN, 20);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(`Continuação • ${formatDate(new Date())}`, MARGIN, 36);
}

function drawSectionTitle(doc, title, y) {
  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), MARGIN, y);
  const lineY = y + 14;
  doc.save();
  doc.moveTo(MARGIN, lineY).lineTo(doc.page.width - MARGIN, lineY).lineWidth(1).stroke(COLORS.line);
  doc.restore();
  return lineY + 8;
}

function drawInfoBox(doc, title, lines, x, y, width) {
  const lineHeight = 14;
  const contentTop = y + 28;
  const boxHeight = 34 + lines.length * lineHeight + 10;

  doc.save();
  doc.roundedRect(x, y, width, boxHeight, 10).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), x + 12, y + 11, {
    width: width - 24,
  });

  lines.forEach((line, index) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, x + 12, contentTop + index * lineHeight, {
      width: width - 24,
      ellipsis: true,
    });
  });

  return boxHeight;
}

function drawMetricCard(doc, label, value, x, y, width) {
  const height = 62;

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(COLORS.panelSoft, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(label.toUpperCase(), x + 12, y + 11, {
    width: width - 24,
  });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(value, x + 12, y + 31, {
    width: width - 24,
  });

  return height;
}

function drawTableHeader(doc, y, widths) {
  const headers = ['Ambiente', 'Medidas', 'Área', 'Rolos', 'Valor'];
  const rowHeight = 24;
  let x = MARGIN;

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 8).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  headers.forEach((header, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(header, x + 8, y + 8, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawEnvironmentRow(doc, environment, y, widths, isAlt) {
  const rowHeight = 24;
  const rolls = toNumber(environment.rolls_manual) > 0
    ? toNumber(environment.rolls_manual)
    : toNumber(environment.rolls_auto);

  const values = [
    toText(environment.name) || '-',
    `${toNumber(environment.height).toFixed(2)}m x ${toNumber(environment.width).toFixed(2)}m`,
    `${toNumber(environment.area).toFixed(2)}m²`,
    `${rolls}`,
    formatCurrency(environment.total),
  ];

  let x = MARGIN;
  const background = isAlt ? '#15110C' : '#110E09';

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 0).fillAndStroke(background, COLORS.line);
  doc.restore();

  values.forEach((value, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(value, x + 8, y + 7, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawTableHeaderWithRemoval(doc, y, widths) {
  const headers = ['Ambiente', 'Medidas', 'Área', 'Rolos', 'Remoção', 'Valor'];
  const rowHeight = 24;
  let x = MARGIN;

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 8).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  headers.forEach((header, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(header, x + 8, y + 8, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawEnvironmentRowWithRemoval(doc, environment, y, widths, isAlt) {
  const rowHeight = 24;
  const rolls = toNumber(environment.rolls_manual) > 0
    ? toNumber(environment.rolls_manual)
    : toNumber(environment.rolls_auto);
  const removalTotal = toNumber(environment.removal_total);

  const values = [
    toText(environment.name) || '-',
    `${toNumber(environment.height).toFixed(2)}m x ${toNumber(environment.width).toFixed(2)}m`,
    `${toNumber(environment.area).toFixed(2)}m²`,
    `${rolls}`,
    formatCurrency(removalTotal),
    formatCurrency(environment.total),
  ];

  let x = MARGIN;
  const background = isAlt ? '#15110C' : '#110E09';

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 0).fillAndStroke(background, COLORS.line);
  doc.restore();

  values.forEach((value, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(value, x + 8, y + 7, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawTotalsPanel(doc, budget, installment, y, width) {
  const panelHeight = 136;
  const total = formatCurrency(budget.total_amount);
  const lines = [
    `Subtotal dos rolos: ${formatCurrency(budget.subtotal_rolls)}`,
    `Remoção: ${formatCurrency(budget.removal_cost)}`,
    `Pagamento à vista: ${total}`,
    installment.enabled
      ? `Pagamento parcelado: ${installment.count}x de ${formatCurrency(installment.installmentValue)}`
      : 'Pagamento parcelado: não habilitado',
  ];

  doc.save();
  doc.roundedRect(MARGIN, y, width, panelHeight, 12).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('RESUMO FINANCEIRO', MARGIN + 14, y + 12);

  lines.forEach((line, index) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, MARGIN + 14, y + 34 + index * 16, {
      width: width - 28,
    });
  });

  doc.save();
  doc.roundedRect(MARGIN + 12, y + panelHeight - 40, width - 24, 26, 8).fillAndStroke('#1F1910', COLORS.border);
  doc.restore();
  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(12).text(`TOTAL GERAL: ${total}`, MARGIN + 18, y + panelHeight - 31);

  return panelHeight;
}

function drawCommercialPanel(doc, budget, y, width) {
  const validityDate = addDays(budget.created_at || new Date(), 30);
  const lines = [
    `Status atual: ${statusLabel(budget.status)}`,
    `Aprovado em: ${formatDate(budget.approved_date)}`,
    `Data sugerida para instalação: ${formatDate(budget.schedule_date)}`,
    `Validade desta proposta: ${formatDate(validityDate)}`,
  ];
  const panelHeight = 110;

  doc.save();
  doc.roundedRect(MARGIN, y, width, panelHeight, 12).fillAndStroke(COLORS.panelSoft, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('CONDIÇÕES COMERCIAIS', MARGIN + 14, y + 12);

  lines.forEach((line, index) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, MARGIN + 14, y + 34 + index * 16, {
      width: width - 28,
    });
  });

  return panelHeight;
}

function drawScopeAndSignature(doc, y, width, userName) {
  const scopeHeight = 132;
  doc.save();
  doc.roundedRect(MARGIN, y, width, scopeHeight, 12).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('ESCOPO E OBSERVAÇÕES', MARGIN + 14, y + 12);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(
    '• Instalação conforme medidas aprovadas e condições do ambiente.\n' +
      '• Materiais, prazos e logística devem ser confirmados no fechamento.\n' +
      '• Alterações após aprovação podem gerar atualização de valores.\n' +
      '• Recomenda-se vistoria final conjunta ao término da instalação.',
    MARGIN + 14,
    y + 34,
    { width: width - 28, lineGap: 2 }
  );

  const signatureY = y + scopeHeight + 14;
  const gap = 34;
  const each = (width - gap) / 2;
  const lineY = signatureY + 24;

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('ASSINATURAS', MARGIN, signatureY);

  doc.save();
  doc.moveTo(MARGIN, lineY).lineTo(MARGIN + each, lineY).lineWidth(1).stroke(COLORS.border);
  doc.moveTo(MARGIN + each + gap, lineY).lineTo(MARGIN + each + gap + each, lineY).lineWidth(1).stroke(COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Cliente', MARGIN, lineY + 6, { width: each, align: 'center' });
  doc.text(userName ? `Instalador • ${userName}` : 'Instalador', MARGIN + each + gap, lineY + 6, {
    width: each,
    align: 'center',
  });

  return scopeHeight + 58;
}

function drawFooter(doc, pageNumber, pageCount, budgetId, user) {
  const footerY = doc.page.height - 44;

  doc.save();
  doc.moveTo(MARGIN, footerY - 8).lineTo(doc.page.width - MARGIN, footerY - 8).lineWidth(1).stroke(COLORS.line);
  doc.restore();

  const leftText = `Bem Instalado • Orçamento #${budgetId}`;
  const centerText = toText(user?.phone) ? `Contato: ${toText(user.phone)}` : 'Documento gerado automaticamente';
  const rightText = `Página ${pageNumber} de ${pageCount}`;

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(leftText, MARGIN, footerY, { width: 220 });
  doc.text(centerText, MARGIN + 150, footerY, { width: 220, align: 'center' });
  doc.text(rightText, doc.page.width - MARGIN - 120, footerY, { width: 120, align: 'right' });
}

module.exports = function generateBudgetPDF({ budget, client, environments, user }) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `orcamento-${budget.id}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    drawMainHeader(doc, budget, user);

    const contentWidth = doc.page.width - MARGIN * 2;
    const gap = 14;
    const halfWidth = (contentWidth - gap) / 2;
    let y = 142;

    y = drawSectionTitle(doc, 'Dados do projeto', y);

    const professionalLines = [
      `Profissional: ${toText(user.name) || '-'}`,
      `Telefone: ${toText(user.phone) || '-'}`,
      `E-mail: ${toText(user.email) || '-'}`,
    ];

    const clientLines = [
      `Cliente: ${toText(client.name) || '-'}`,
      `Telefone: ${toText(client.phone) || '-'}`,
      `E-mail: ${toText(client.email) || '-'}`,
      `Endereço: ${buildClientAddress(client)}`,
    ];

    const leftHeight = drawInfoBox(doc, 'Instalador', professionalLines, MARGIN, y, halfWidth);
    const rightHeight = drawInfoBox(doc, 'Cliente e local', clientLines, MARGIN + halfWidth + gap, y, halfWidth);
    y += Math.max(leftHeight, rightHeight) + 16;

    const installment = installmentInfo(budget);
    const metricWidth = (contentWidth - gap * 3) / 4;
    drawMetricCard(doc, 'Rolos', `${toNumber(budget.total_rolls)} un`, MARGIN, y, metricWidth);
    drawMetricCard(doc, 'Área total', `${toNumber(budget.total_area).toFixed(2)} m²`, MARGIN + metricWidth + gap, y, metricWidth);
    drawMetricCard(doc, 'Valor total', formatCurrency(budget.total_amount), MARGIN + (metricWidth + gap) * 2, y, metricWidth);
    drawMetricCard(
      doc,
      'Parcelamento',
      installment.enabled ? `${installment.count}x de ${formatCurrency(installment.installmentValue)}` : 'À vista',
      MARGIN + (metricWidth + gap) * 3,
      y,
      metricWidth
    );
    y += 76;

    y = drawSectionTitle(doc, 'Detalhamento dos ambientes', y);
    const tableWidths = [150, 102, 60, 50, 82, contentWidth - (150 + 102 + 60 + 50 + 82)];
    y = drawTableHeaderWithRemoval(doc, y, tableWidths);

    environments.forEach((environment, index) => {
      if (!canFit(doc, y, 28)) {
        doc.addPage();
        drawSubHeader(doc, budget);
        y = 72;
        y = drawSectionTitle(doc, 'Detalhamento dos ambientes (continuação)', y);
        y = drawTableHeaderWithRemoval(doc, y, tableWidths);
      }

      y = drawEnvironmentRowWithRemoval(doc, environment, y, tableWidths, index % 2 === 1);
    });

    y += 14;

    if (!canFit(doc, y, 380)) {
      doc.addPage();
      drawSubHeader(doc, budget);
      y = 72;
    }

    y = drawSectionTitle(doc, 'Resumo e fechamento', y);
    y += drawTotalsPanel(doc, budget, installment, y, contentWidth) + 12;
    y += drawCommercialPanel(doc, budget, y, contentWidth) + 12;
    drawScopeAndSignature(doc, y, contentWidth, toText(user.name));

    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i += 1) {
      doc.switchToPage(i);
      drawFooter(doc, i + 1, pageRange.count, budget.id, user);
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};
