import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import PageIntro from '../Layout/PageIntro';
import { formatDateTime, formatStatusLabel } from '../../utils/formatters';

const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date) {
  const safeDate = cloneDate(date);
  const weekDay = safeDate.getDay();
  const shift = (weekDay + 6) % 7;
  safeDate.setDate(safeDate.getDate() - shift);
  return safeDate;
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function sameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function sameMonth(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function dateKey(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthLabel(date) {
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function selectedDayLabel(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function buildCalendarDays(viewDate) {
  const start = startOfWeek(startOfMonth(viewDate));
  const end = endOfWeek(endOfMonth(viewDate));
  const days = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    days.push(new Date(current));
  }

  return days;
}

function getStatusTone(status) {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'canceled') {
    return 'canceled';
  }

  return 'scheduled';
}

function formatDestinationLine(destination) {
  if (!destination) {
    return 'Endereço não informado.';
  }

  const streetLine = [destination.street, destination.house_number && `Nº ${destination.house_number}`]
    .filter(Boolean)
    .join(', ');
  const cityLine = [destination.neighborhood, [destination.city, destination.state].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ');
  const zipLine = destination.zip_code ? `CEP ${destination.zip_code}` : '';
  return [streetLine, cityLine, zipLine]
    .filter(Boolean)
    .join(' • ') || destination.full_address || 'Endereço não informado.';
}

export default function Agenda() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(cloneDate(new Date()));

  const loadAgenda = async () => {
    setLoading(true);

    try {
      const response = await api.get('/schedules');
      setItems(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
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
      toast.error(error.response?.data?.error || 'Não foi possível atualizar a agenda.');
    }
  };

  const deleteSchedule = async (id) => {
    const confirmed = await confirm({
      title: 'Excluir agendamento',
      message: 'Deseja excluir este agendamento?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/schedules/${id}`);
      toast.success('Agendamento excluído.');
      loadAgenda();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir o agendamento.');
    }
  };

  const openRoute = (url) => {
    if (!url) {
      toast.error('Endereço insuficiente para abrir rota.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyAddress = async (address) => {
    if (!address) {
      toast.error('Endereço não informado.');
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      toast.success('Endereço copiado.');
    } catch (_error) {
      toast.error('Não foi possível copiar o endereço.');
    }
  };

  const agendaByDay = {};

  items.forEach((item) => {
    const date = parseDate(item.date);

    if (!date) {
      return;
    }

    const key = dateKey(date);

    if (!agendaByDay[key]) {
      agendaByDay[key] = [];
    }

    agendaByDay[key].push({ ...item, parsedDate: date });
  });

  Object.values(agendaByDay).forEach((dayItems) => {
    dayItems.sort((first, second) => first.parsedDate - second.parsedDate);
  });

  const calendarDays = buildCalendarDays(viewDate);
  const selectedItems = agendaByDay[dateKey(selectedDate)] || [];
  const today = cloneDate(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const busyDaysCount = Object.keys(agendaByDay).length;
  const weekItemsCount = items.filter((item) => {
    const date = parseDate(item.date);

    if (!date) {
      return false;
    }

    return date >= weekStart && date <= addDays(weekEnd, 1);
  }).length;

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="Visualize o mês inteiro, toque em qualquer dia e veja exatamente o que precisa acontecer naquela data."
        eyebrow="Agenda"
        stats={[
          { label: 'Eventos no mês', value: `${items.length}`, detail: 'Todos os agendamentos ativos e passados.' },
          { label: 'Dias ocupados', value: `${busyDaysCount}`, detail: 'Datas que já têm instalação planejada.' },
          { label: 'Semana atual', value: `${weekItemsCount}`, detail: 'Compromissos concentrados nos próximos dias.' },
        ]}
        title="Um calendário visual para decidir, acompanhar e agir rápido."
      />

      <section className="schedule-shell">
        <div className="schedule-calendar-panel lux-panel fade-up p-6 sm:p-7">
          <div className="schedule-calendar-toolbar">
            <div>
              <p className="eyebrow">Calendário</p>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">{monthLabel(viewDate)}</h2>
            </div>

            <div className="schedule-toolbar-actions">
              <button
                className="ghost-button"
                onClick={() => setViewDate((current) => addMonths(current, -1))}
                type="button"
              >
                Mês anterior
              </button>
              <button
                className="ghost-button"
                onClick={() => setViewDate(startOfMonth(new Date()))}
                type="button"
              >
                Hoje
              </button>
              <button
                className="gold-button"
                onClick={() => setViewDate((current) => addMonths(current, 1))}
                type="button"
              >
                Próximo mês
              </button>
            </div>
          </div>

          <div className="schedule-grid-scroll mt-8">
            <div className="schedule-weekdays">
              {weekLabels.map((label) => (
                <span className="schedule-weekday" key={label}>
                  {label}
                </span>
              ))}
            </div>

            <div className="schedule-grid">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const dayItems = agendaByDay[key] || [];
                const isSelected = sameDay(day, selectedDate);
                const isToday = sameDay(day, today);
                const isOutside = !sameMonth(day, viewDate);

                return (
                  <button
                    className="schedule-day-cell"
                    data-outside={isOutside}
                    data-selected={isSelected}
                    data-today={isToday}
                    key={key}
                    onClick={() => {
                      setSelectedDate(day);

                      if (!sameMonth(day, viewDate)) {
                        setViewDate(startOfMonth(day));
                      }
                    }}
                    type="button"
                  >
                    <div className="schedule-day-top">
                      <span className="schedule-day-number">{day.getDate()}</span>
                      {dayItems.length ? (
                        <span className="schedule-day-count">{dayItems.length}</span>
                      ) : null}
                    </div>

                    <div className="schedule-day-dots">
                      {dayItems.slice(0, 3).map((item) => (
                        <span
                          className="schedule-day-dot"
                          data-tone={getStatusTone(item.status)}
                          key={item.id}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="schedule-day-panel lux-panel fade-up p-6 sm:p-7" style={{ animationDelay: '0.08s' }}>
          <p className="eyebrow">Dia selecionado</p>
          <h2 className="page-title mt-3 text-[2.2rem] leading-none">
            {selectedDayLabel(selectedDate)}
          </h2>
          <p className="page-copy mt-4">
            {selectedItems.length
              ? `${selectedItems.length} agendamento(s) encontrados para esta data.`
              : 'Nenhum compromisso marcado para este dia.'}
          </p>

          <div className="mt-6 grid gap-4">
            {loading ? (
              <div className="empty-state">Carregando compromissos do calendário...</div>
            ) : null}

            {!loading && selectedItems.length === 0 ? (
              <div className="empty-state">
                Esse dia ainda está livre. Assim que houver uma instalação com data marcada, ela aparece aqui.
              </div>
            ) : null}

            {selectedItems.map((item) => (
              <article className="schedule-appointment-card" key={item.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg font-semibold text-[var(--text)]">{item.title}</p>
                  <span className="status-pill" data-tone={item.status}>
                    {formatStatusLabel(item.status)}
                  </span>
                </div>

                <p className="schedule-appointment-time">{formatDateTime(item.date)}</p>
                {item.client_name ? (
                  <p className="mt-2 text-sm text-[var(--gold-strong)]">Cliente: {item.client_name}</p>
                ) : null}
                <p className="mt-2 text-sm text-[var(--muted)]">
                  <strong className="text-[var(--text)]">Rua:</strong> {item.destination?.street || '-'}
                  {item.destination?.house_number ? `, Nº ${item.destination.house_number}` : ''}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <strong className="text-[var(--text)]">Local:</strong>{' '}
                  {[item.destination?.neighborhood, item.destination?.city, item.destination?.state]
                    .filter(Boolean)
                    .join(' - ') || '-'}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <strong className="text-[var(--text)]">Especificação:</strong> {item.destination?.reference || '-'}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">{formatDestinationLine(item.destination)}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="ghost-button w-full sm:w-auto"
                    onClick={() => openRoute(item.route_links?.google_maps)}
                    type="button"
                  >
                    Abrir rota no GPS
                  </button>
                  <button
                    className="ghost-button w-full sm:w-auto"
                    onClick={() => openRoute(item.route_links?.waze)}
                    type="button"
                  >
                    Abrir no Waze
                  </button>
                  <button
                    className="ghost-button w-full sm:w-auto"
                    onClick={() => copyAddress(item.destination?.full_address || item.destination?.route_query)}
                    type="button"
                  >
                    Copiar endereço
                  </button>
                  <button className="gold-button w-full sm:w-auto" onClick={() => updateStatus(item.id, 'completed')} type="button">
                    Concluir
                  </button>
                  <button className="danger-button w-full sm:w-auto" onClick={() => updateStatus(item.id, 'canceled')} type="button">
                    Cancelar
                  </button>
                  <button className="ghost-button w-full sm:w-auto" onClick={() => deleteSchedule(item.id)} type="button">
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}
