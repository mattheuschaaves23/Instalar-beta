const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatShortDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return shortDateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return dateTimeFormatter.format(date);
}

export function formatLongDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return longDateFormatter.format(date);
}

export function formatStatusLabel(status) {
  const map = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    scheduled: 'Agendado',
    completed: 'Concluido',
    canceled: 'Cancelado',
    active: 'Ativa',
    inactive: 'Inativa',
    paid: 'Pago',
    failed: 'Falhou',
    success: 'Sucesso',
    warning: 'Aviso',
    info: 'Informacao',
  };

  return map[status] || status || '-';
}
