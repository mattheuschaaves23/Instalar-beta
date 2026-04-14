import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import { formatCurrency, formatLongDate } from '../../utils/formatters';

export default function Dashboard() {
  const [data, setData] = useState({
    metrics: {
      monthly_revenue: 0,
      installations_this_week: 0,
      completed_this_week: 0,
      available_dates: [],
      ranking_position: null,
      average_rating: 0,
      review_count: 0,
      approved_this_month: 0,
      pending_budgets: 0,
      monthly_goal: 0,
      goal_progress: 0,
      public_profile: true,
      profile_completeness: 0,
    },
    motivation: [],
    ranking: [],
    profile: {},
  });

  useEffect(() => {
    api
      .get('/users/dashboard')
      .then((response) => setData(response.data))
      .catch((error) => {
        toast.error(error.response?.data?.error || 'Não foi possível carregar o dashboard.');
      });
  }, []);

  const { metrics, motivation, ranking, profile } = data;
  const regionLabel =
    [profile.city, profile.state].filter(Boolean).join(' - ') || profile.service_region || 'Região não informada';

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        actions={
          <>
            <Link className="gold-button" to="/budgets/new">
              Novo orçamento
            </Link>
            <Link className="ghost-button" to="/agenda">
              Ver agenda
            </Link>
          </>
        }
        description="Seu resumo diário para vender com mais consistência e executar sem atrasos."
        eyebrow="Painel do instalador"
        stats={[
          {
            label: 'Faturamento no mês',
            value: formatCurrency(metrics.monthly_revenue),
            detail: `Meta: ${formatCurrency(metrics.monthly_goal)}.`,
          },
          {
            label: 'Instalações da semana',
            value: `${metrics.installations_this_week}`,
            detail: `${metrics.completed_this_week} concluídas.`,
          },
          {
            label: 'Posição no ranking',
            value: metrics.ranking_position ? `#${metrics.ranking_position}` : '--',
            detail: `${metrics.review_count} avaliações recebidas.`,
          },
        ]}
        title="Seu negócio em números, sem complicação."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid gap-5">
          <article className="lux-panel fade-up p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Resumo comercial</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Pipeline do mês</h2>
              </div>
              <span className="status-pill" data-tone={metrics.goal_progress >= 100 ? 'success' : 'pending'}>
                {metrics.goal_progress}% da meta
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="metric-card !p-5">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Aprovados</p>
                <p className="metric-value mt-2">{metrics.approved_this_month}</p>
              </article>
              <article className="metric-card !p-5">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Pendentes</p>
                <p className="metric-value mt-2">{metrics.pending_budgets}</p>
              </article>
              <article className="metric-card !p-5">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Nota média</p>
                <p className="metric-value mt-2">{Number(metrics.average_rating || 0).toFixed(1)}</p>
              </article>
              <article className="metric-card !p-5">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Perfil completo</p>
                <p className="metric-value mt-2">{metrics.profile_completeness}%</p>
              </article>
            </div>
          </article>

          <article className="lux-panel fade-up p-6" style={{ animationDelay: '0.08s' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Agenda e disponibilidade</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Próximas datas livres</h2>
              </div>
              <Link className="ghost-button" to="/profile">
                Editar horários
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {metrics.available_dates?.length ? (
                metrics.available_dates.map((date) => (
                  <span className="status-pill" data-tone="scheduled" key={date}>
                    {formatLongDate(date)}
                  </span>
                ))
              ) : (
                <div className="empty-state w-full">
                  Você ainda não definiu horários vagos no perfil.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.015)] p-4 text-sm text-[var(--muted)]">
              Região de atendimento: <strong className="text-[var(--text)]">{regionLabel}</strong>. Perfil público{' '}
              <strong className="text-[var(--text)]">{metrics.public_profile ? 'ativo' : 'inativo'}</strong>.
            </div>
          </article>

          {motivation.length > 0 ? (
            <article className="lux-panel-soft fade-up rounded-[22px] p-6" style={{ animationDelay: '0.12s' }}>
              <p className="eyebrow">Foco da semana</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {motivation.slice(0, 3).map((item) => (
                  <div className="rounded-[16px] border border-[var(--line)] bg-[rgba(255,255,255,0.016)] p-4" key={item.title}>
                    <p className="font-semibold text-[var(--text)]">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>

        <aside className="grid gap-5">
          <section className="lux-panel fade-up p-5" style={{ animationDelay: '0.06s' }}>
            <p className="eyebrow">Top instaladores</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Ranking público</h2>

            <div className="mt-4 grid gap-2">
              {ranking.length ? (
                ranking.map((item) => (
                  <article
                    className="rounded-[14px] border border-[var(--line)] bg-[rgba(255,255,255,0.018)] px-3 py-3"
                    key={item.id}
                  >
                    <p className="truncate text-sm font-semibold text-[var(--text)]">
                      #{item.ranking_position} {item.display_name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {Number(item.average_rating || 0).toFixed(1)} • {item.review_count} avaliações
                    </p>
                  </article>
                ))
              ) : (
                <div className="empty-state !p-4 text-sm">Ranking ainda sem dados suficientes.</div>
              )}
            </div>
          </section>

          <section className="lux-panel-soft fade-up rounded-[22px] p-5" style={{ animationDelay: '0.1s' }}>
            <p className="eyebrow">Atalhos</p>
            <div className="mt-3 grid gap-2">
              <Link className="ghost-button w-full justify-center" to="/clients">
                Gerenciar clientes
              </Link>
              <Link className="ghost-button w-full justify-center" to="/budgets">
                Ver propostas
              </Link>
              <Link className="ghost-button w-full justify-center" to="/subscription">
                Conferir assinatura
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
