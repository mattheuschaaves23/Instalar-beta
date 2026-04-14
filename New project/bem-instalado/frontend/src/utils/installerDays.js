export const installationDayOptions = [
  { value: 'mon', label: 'Segunda' },
  { value: 'tue', label: 'Terça' },
  { value: 'wed', label: 'Quarta' },
  { value: 'thu', label: 'Quinta' },
  { value: 'fri', label: 'Sexta' },
  { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
];

export function formatInstallationDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return 'Dias ainda não configurados';
  }

  const labelMap = new Map(installationDayOptions.map((item) => [item.value, item.label]));
  return days.map((day) => labelMap.get(day) || day).join(', ');
}
