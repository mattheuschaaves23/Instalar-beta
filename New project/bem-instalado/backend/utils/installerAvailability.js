const VALID_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeInstallationDays(value) {
  if (Array.isArray(value)) {
    return value.filter((day) => VALID_DAYS.includes(day));
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((day) => VALID_DAYS.includes(day));
  }

  return [];
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekdayKey(date) {
  return VALID_DAYS[date.getDay()];
}

function buildAvailableDates(installationDays, busyDates = [], limit = 5) {
  const normalizedDays = normalizeInstallationDays(installationDays);

  if (!normalizedDays.length) {
    return [];
  }

  const blocked = new Set(
    busyDates
      .filter(Boolean)
      .map((value) => dateKey(new Date(value)))
  );

  const results = [];
  const current = new Date();
  current.setHours(12, 0, 0, 0);

  for (let step = 0; step < 35 && results.length < limit; step += 1) {
    const candidate = new Date(current);
    candidate.setDate(current.getDate() + step);

    if (!normalizedDays.includes(weekdayKey(candidate))) {
      continue;
    }

    const key = dateKey(candidate);

    if (blocked.has(key)) {
      continue;
    }

    results.push(candidate.toISOString());
  }

  return results;
}

module.exports = {
  buildAvailableDates,
  normalizeInstallationDays,
};
