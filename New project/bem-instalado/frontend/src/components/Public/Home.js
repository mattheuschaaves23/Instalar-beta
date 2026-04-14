import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatLongDate } from '../../utils/formatters';
import { formatInstallationDays } from '../../utils/installerDays';
import BrandMark from '../Layout/BrandMark';
import BrandWordmark from '../Layout/BrandWordmark';
import PaginationControls from '../Layout/PaginationControls';

const AUTO_LOCATION_SESSION_KEY = 'bem_instalado_client_location_checked';
const INSTALLERS_PER_PAGE = 5;
const emptyReview = { reviewer_name: '', reviewer_region: '', rating: 5, comment: '' };
const defaultMarketplace = {
  title: 'Loja Oficial Bem Instalado',
  description:
    'A loja oficial Bem Instalado Home Decor reúne papéis de parede para vários estilos, com operação em Florianópolis e atendimento para todo o Brasil.',
  url: 'https://www.beminstalado.com.br',
  cta_label: 'Visitar loja oficial',
  whatsapp_url: 'https://api.whatsapp.com/send?phone=5548999816000',
  contact_phone: '(48) 99981-6000',
  contact_email: 'beminstaladohd@gmail.com',
  highlights: ['Papel de parede', 'Infantil e ambientes', 'Pagamento via Pix'],
};

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function RatingStars({ value }) {
  const rounded = Math.round(Number(value || 0));

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          className={`h-2.5 w-2.5 rounded-full border border-[var(--gold)] ${
            index < rounded ? 'bg-[var(--gold)]' : 'bg-transparent'
          }`}
          key={index}
        />
      ))}
    </div>
  );
}

function formatAvailabilitySlotLabel(slot) {
  if (!slot?.slot_date) {
    return '';
  }

  const dateLabel = formatLongDate(`${slot.slot_date}T12:00:00`);
  return `${dateLabel} • ${slot.start_time} - ${slot.end_time}`;
}

function buildSuggestionScenarios(filters) {
  const scenarios = [];
  const city = String(filters.city || '').trim();
  const state = String(filters.state || '').trim();
  const search = String(filters.search || '').trim();

  if (state) {
    scenarios.push({
      label: `Instaladores próximos em ${state}`,
      params: { search: '', city: '', state },
    });
  }

  if (city) {
    scenarios.push({
      label: `Resultados parecidos com ${city}`,
      params: { search: city, city: '', state },
    });
  }

  if (search) {
    scenarios.push({
      label: 'Sugestões relacionadas',
      params: { search, city: '', state: '' },
    });
  }

  scenarios.push({
    label: 'Instaladores em destaque',
    params: { search: '', city: '', state: '' },
  });

  const seen = new Set();
  return scenarios.filter((scenario) => {
    const key = JSON.stringify(scenario.params);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default function Home() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: '', city: '', state: '' });
  const [directory, setDirectory] = useState({ installers: [], ranking: [], reviews: [], marketplace: null });
  const [loading, setLoading] = useState(true);
  const [locationState, setLocationState] = useState({
    status: 'idle',
    message: 'Ative sua localização para encontrar profissionais mais próximos.',
  });
  const [activeReviewInstaller, setActiveReviewInstaller] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [installersPage, setInstallersPage] = useState(1);
  const [noResultsSuggestions, setNoResultsSuggestions] = useState({
    loading: false,
    label: '',
    items: [],
  });

  const totalInstallersPages = Math.max(1, Math.ceil(directory.installers.length / INSTALLERS_PER_PAGE));
  const normalizedInstallersPage = Math.min(installersPage, totalInstallersPages);
  const installersStart = (normalizedInstallersPage - 1) * INSTALLERS_PER_PAGE;
  const paginatedInstallers = useMemo(
    () => directory.installers.slice(installersStart, installersStart + INSTALLERS_PER_PAGE),
    [directory.installers, installersStart]
  );
  const marketplace = directory.marketplace || defaultMarketplace;
  const highlightedInstallers = directory.ranking.length;
  const recentReviews = directory.reviews.length;
  const hasActiveFilters = useMemo(
    () => Boolean(filters.search.trim() || filters.city.trim() || filters.state.trim()),
    [filters.search, filters.city, filters.state]
  );

  const loadDirectory = async (nextFilters = filters) => {
    setLoading(true);

    try {
      const response = await api.get('/public/installers', { params: nextFilters });
      setDirectory(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os instaladores.');
    } finally {
      setLoading(false);
    }
  };

  const reverseLocation = async (latitude, longitude) => {
    const response = await api.get('/public/location/reverse', {
      params: { lat: latitude, lon: longitude },
    });

    return response.data;
  };

  const requestLocationSearch = async ({ silent = false } = {}) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationState({
        status: 'unsupported',
        message: 'Seu navegador não oferece localização automática. Você pode buscar manualmente.',
      });
      return;
    }

    setLocationState({
      status: 'locating',
      message: 'Buscando sua região para filtrar os instaladores.',
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const region = await reverseLocation(position.coords.latitude, position.coords.longitude);
          const nextFilters = {
            ...filters,
            city: region.city || '',
            state: region.state || '',
          };

          setFilters(nextFilters);
          setInstallersPage(1);
          setLocationState({
            status: 'resolved',
            message: region.label
              ? `Mostrando profissionais próximos de ${region.label}.`
              : 'Mostrando profissionais da sua região.',
          });

          if (!silent) {
            toast.success(region.label ? `Região encontrada: ${region.label}.` : 'Região encontrada.');
          }

          await loadDirectory(nextFilters);
        } catch (error) {
          setLocationState({
            status: 'error',
            message: error.response?.data?.error || 'Não foi possível localizar sua região agora.',
          });

          if (!silent) {
            toast.error(error.response?.data?.error || 'Não foi possível localizar sua região agora.');
          }
        }
      },
      (error) => {
        const permissionDenied = error.code === 1;
        setLocationState({
          status: permissionDenied ? 'denied' : 'error',
          message: permissionDenied
            ? 'Permita a localização para mostrar primeiro os profissionais da sua região.'
            : 'Não foi possível usar sua localização no momento.',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.sessionStorage.getItem(AUTO_LOCATION_SESSION_KEY) === 'done') {
      return;
    }

    window.sessionStorage.setItem(AUTO_LOCATION_SESSION_KEY, 'done');
    requestLocationSearch({ silent: true });
  }, []);

  const handleFilterChange = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setInstallersPage(1);
    await loadDirectory(filters);
  };

  const clearFilters = async () => {
    const nextFilters = { search: '', city: '', state: '' };
    setFilters(nextFilters);
    setInstallersPage(1);
    await loadDirectory(nextFilters);
  };

  const updateReviewDraft = (installerId, field, value) => {
    setReviewDrafts((current) => ({
      ...current,
      [installerId]: {
        ...(current[installerId] || emptyReview),
        [field]: value,
      },
    }));
  };

  const submitReview = async (installerId) => {
    const payload = reviewDrafts[installerId] || emptyReview;
    const isOwnProfile = Boolean(user && Number(user.id) === Number(installerId));

    if (isOwnProfile) {
      toast.error('Você não pode avaliar o seu próprio perfil.');
      return;
    }

    try {
      await api.post(`/public/installers/${installerId}/reviews`, payload);
      toast.success('Avaliação enviada.');
      setReviewDrafts((current) => ({ ...current, [installerId]: emptyReview }));
      setActiveReviewInstaller(null);
      await loadDirectory(filters);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar a avaliação.');
    }
  };

  useEffect(() => {
    if (loading) {
      return;
    }

    if (directory.installers.length > 0 || !hasActiveFilters) {
      setNoResultsSuggestions({ loading: false, label: '', items: [] });
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setNoResultsSuggestions({ loading: true, label: '', items: [] });
      const scenarios = buildSuggestionScenarios(filters);

      for (const scenario of scenarios) {
        try {
          const response = await api.get('/public/installers', { params: scenario.params });
          const suggestions = (response.data?.installers || []).slice(0, 4);

          if (suggestions.length > 0) {
            if (!cancelled) {
              setNoResultsSuggestions({
                loading: false,
                label: scenario.label,
                items: suggestions,
              });
            }
            return;
          }
        } catch (_error) {
          // Tenta automaticamente o próximo cenário.
        }
      }

      if (!cancelled) {
        setNoResultsSuggestions({ loading: false, label: '', items: [] });
      }
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [loading, directory.installers.length, hasActiveFilters, filters.search, filters.city, filters.state]);

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden px-4 py-8 md:px-6 lg:px-8">
      <div className="page-shell mx-auto flex w-full max-w-7xl flex-col gap-7">
        <div className="client-topbar fade-up">
          <div className="client-topbar-brand">
            <BrandMark className="client-brand-mark" />
            <div className="client-topbar-brand-content">
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p className="client-topbar-copy">A primeira busca confiável para contratar instaladores perto de você.</p>
            </div>
          </div>

          <div className="client-topbar-actions">
            {user ? (
              <Link className="ghost-button" to="/dashboard">
                Abrir meu painel
              </Link>
            ) : null}
            {!user ? (
              <Link className="gold-button" to="/instalador/entrar">
                Login ou criar conta (instalador)
              </Link>
            ) : null}
          </div>
        </div>

        <header className="lux-panel fade-up overflow-hidden p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-start">
            <div className="min-w-0">
              <p className="eyebrow">InstaLar • Área do cliente</p>
              <h1 className="hero-title mt-4 max-w-4xl">
                Encontre instaladores da sua região com clareza e segurança.
              </h1>
              <p className="page-copy mt-4 max-w-3xl">
                Pesquise por cidade, estado ou estilo de instalação. Veja avaliações reais, horários vagos e abra o perfil
                completo do profissional antes de decidir.
              </p>

              <div className="hero-key-points mt-5">
                <span className="status-pill" data-tone="info">
                  Busca por cidade e estado
                </span>
                <span className="status-pill" data-tone="info">
                  Avaliações verificadas
                </span>
                <span className="status-pill" data-tone="info">
                  Contato direto por WhatsApp
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a className="gold-button" href="#lista-instaladores">
                  Ver instaladores agora
                </a>
              </div>

              <div className="hero-kpis mt-6">
                <article className="hero-kpi">
                  <strong>{directory.installers.length}</strong>
                  <span>Instaladores listados</span>
                </article>
                <article className="hero-kpi">
                  <strong>{highlightedInstallers}</strong>
                  <span>Perfis em destaque</span>
                </article>
                <article className="hero-kpi">
                  <strong>{recentReviews}</strong>
                  <span>Avaliações recentes</span>
                </article>
              </div>
            </div>

            <aside className="lux-panel-soft rounded-[24px] p-5">
              <p className="eyebrow">Busca rápida</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{locationState.message}</p>

              <button className="ghost-button mt-4 w-full" onClick={() => requestLocationSearch()} type="button">
                {locationState.status === 'locating' ? 'Localizando...' : 'Usar minha localização'}
              </button>

              <form className="mt-5 space-y-3" onSubmit={handleSearch}>
                <label className="block">
                  <span className="field-label">Busca geral</span>
                  <input
                    className="field-input"
                    name="search"
                    onChange={handleFilterChange}
                    placeholder="Nome, região ou estilo de instalação"
                    value={filters.search}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Cidade</span>
                    <input
                      className="field-input"
                      name="city"
                      onChange={handleFilterChange}
                      placeholder="Ex.: Blumenau"
                      value={filters.city}
                    />
                  </label>

                  <label className="block">
                    <span className="field-label">Estado</span>
                    <input
                      className="field-input"
                      name="state"
                      onChange={handleFilterChange}
                      placeholder="Ex.: SC"
                      value={filters.state}
                    />
                  </label>
                </div>

                <button className="gold-button mt-1 w-full" type="submit">
                  Buscar instaladores
                </button>
              </form>
            </aside>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]" id="lista-instaladores">
          <div className="grid gap-4">
            {loading ? <div className="empty-state">Carregando instaladores...</div> : null}

            {!loading && directory.installers.length === 0 ? (
              <div className="empty-state">
                <p className="text-base font-semibold text-[var(--text)]">Nenhum instalador encontrado com esse filtro.</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Ajuste cidade, estado ou termo da busca. Abaixo mostramos sugestões automáticas para você não ficar sem opção.
                </p>
                {hasActiveFilters ? (
                  <button className="ghost-button mt-4" onClick={clearFilters} type="button">
                    Limpar filtros e ver todos
                  </button>
                ) : null}
              </div>
            ) : null}

            {!loading && directory.installers.length === 0 && hasActiveFilters ? (
              <section className="lux-panel-soft rounded-[20px] p-4">
                <p className="eyebrow">Sugestões automáticas</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {noResultsSuggestions.loading
                    ? 'Buscando instaladores parecidos para você...'
                    : noResultsSuggestions.label || 'Confira instaladores em destaque enquanto ajustamos sua busca.'}
                </p>

                {!noResultsSuggestions.loading && noResultsSuggestions.items.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {noResultsSuggestions.items.map((installer) => (
                      <article
                        className="rounded-[14px] border border-[var(--line)] bg-[rgba(255,255,255,0.015)] p-3"
                        key={`suggestion-${installer.id}`}
                      >
                        <div className="flex items-start gap-3">
                          {installer.installer_photo ? (
                            <img
                              alt={`Foto de ${installer.display_name}`}
                              className="h-12 w-12 rounded-full border border-[var(--line)] object-cover"
                              src={installer.installer_photo}
                            />
                          ) : installer.logo ? (
                            <img
                              alt={`Logo de ${installer.display_name}`}
                              className="h-12 w-12 rounded-[12px] border border-[var(--line)] object-cover"
                              src={installer.logo}
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--line)] bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold-strong)]">
                              {getInitials(installer.display_name)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">{installer.display_name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {[installer.city, installer.state].filter(Boolean).join(' - ') || 'Região não informada'}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                              <RatingStars value={installer.average_rating} />
                              <span>{Number(installer.average_rating || 0).toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link className="gold-button !min-h-[2.5rem] !px-4 !text-xs" to={`/installers/${installer.id}`}>
                            Ver perfil
                          </Link>
                          {installer.whatsapp_link ? (
                            <a
                              className="ghost-button !min-h-[2.5rem] !px-4 !text-xs"
                              href={installer.whatsapp_link}
                              rel="noreferrer"
                              target="_blank"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {paginatedInstallers.map((installer, index) => {
              const reviewDraft = reviewDrafts[installer.id] || emptyReview;
              const isOwnInstallerProfile = Boolean(user && Number(user.id) === Number(installer.id));
              const isReviewOpen = activeReviewInstaller === installer.id && !isOwnInstallerProfile;

              return (
                <article
                  className="lux-panel fade-up overflow-hidden p-6"
                  key={installer.id}
                  style={{ animationDelay: `${0.05 + index * 0.04}s` }}
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex gap-4">
                        {installer.installer_photo ? (
                          <img
                            alt={`Foto de ${installer.display_name}`}
                            className="h-16 w-16 shrink-0 rounded-full border border-[var(--line)] object-cover"
                            src={installer.installer_photo}
                          />
                        ) : installer.logo ? (
                          <img
                            alt={`Logo de ${installer.display_name}`}
                            className="h-16 w-16 shrink-0 rounded-[16px] border border-[var(--line)] object-cover"
                            src={installer.logo}
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] border border-[var(--line)] bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold-strong)]">
                            {getInitials(installer.display_name)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="break-words text-2xl font-semibold text-[var(--text)]">{installer.display_name}</h2>
                            <span className="status-pill" data-tone="active">
                              {installer.review_count > 0 ? `${Number(installer.average_rating).toFixed(1)} de nota` : 'Novo perfil'}
                            </span>
                            {installer.featured_installer ? (
                              <span className="status-pill" data-tone="success">Destaque</span>
                            ) : null}
                            {installer.certificate_verified ? (
                              <span className="status-pill" data-tone="success">Certificado verificado</span>
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                            <RatingStars value={installer.average_rating} />
                            <span>{installer.review_count} avaliações</span>
                            <span>•</span>
                            <span>{installer.completed_jobs || 0} instalações concluídas</span>
                          </div>

                          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                            {installer.bio || 'Este instalador ainda está atualizando sua apresentação pública.'}
                          </p>

                          <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
                            <p>
                              Região:{' '}
                              {[installer.city, installer.state].filter(Boolean).join(' - ') ||
                                installer.service_region ||
                                'Não informada'}
                            </p>
                            <p>Atendimento: {installer.service_hours || 'Não informado'}</p>
                            <p>Estilo: {installer.installation_method || 'Não informado'}</p>
                            <p>Dias: {formatInstallationDays(installer.installation_days)}</p>
                            <p>Custo base: {formatCurrency(installer.base_service_cost)}</p>
                            <p>Deslocamento: {formatCurrency(installer.travel_fee)}</p>
                          </div>

                          {installer.installation_gallery_preview?.length ? (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {installer.installation_gallery_preview.map((photo, photoIndex) => (
                                <img
                                  alt={`Instalação ${photoIndex + 1} de ${installer.display_name}`}
                                  className="h-24 w-full rounded-[10px] border border-[var(--line)] object-cover"
                                  key={`${installer.id}-preview-${photoIndex}`}
                                  src={photo}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {installer.whatsapp_link ? (
                          <a className="ghost-button" href={installer.whatsapp_link} rel="noreferrer" target="_blank">
                            Contatar no WhatsApp
                          </a>
                        ) : null}
                        <Link className="gold-button" to={`/installers/${installer.id}`}>
                          Ver perfil completo
                        </Link>
                        {isOwnInstallerProfile ? (
                          <span className="status-pill" data-tone="info">
                            Este perfil é seu
                          </span>
                        ) : (
                          <button
                            className="ghost-button"
                            onClick={() =>
                              setActiveReviewInstaller((current) => (current === installer.id ? null : installer.id))
                            }
                            type="button"
                          >
                            Avaliar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.014)] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--gold-strong)]">Próximas datas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {installer.available_dates?.length ? (
                          installer.available_dates.map((date) => (
                            <span className="status-pill" data-tone="scheduled" key={date}>
                              {formatLongDate(date)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--muted)]">Datas ainda não informadas.</span>
                        )}
                      </div>

                      <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--gold-strong)]">
                        Horários vagos
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {installer.availability_slots?.length ? (
                          installer.availability_slots.slice(0, 4).map((slot) => (
                            <span className="status-pill" data-tone="active" key={slot.id}>
                              {formatAvailabilitySlotLabel(slot)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--muted)]">Abra o perfil completo para ver detalhes.</span>
                        )}
                      </div>
                    </div>

                    {isReviewOpen ? (
                      <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.014)] p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <span className="field-label">Seu nome</span>
                            <input
                              className="field-input"
                              onChange={(event) => updateReviewDraft(installer.id, 'reviewer_name', event.target.value)}
                              placeholder="Como você quer aparecer"
                              value={reviewDraft.reviewer_name}
                            />
                          </label>

                          <label className="block">
                            <span className="field-label">Sua região</span>
                            <input
                              className="field-input"
                              onChange={(event) => updateReviewDraft(installer.id, 'reviewer_region', event.target.value)}
                              placeholder="Cidade ou bairro"
                              value={reviewDraft.reviewer_region}
                            />
                          </label>
                        </div>

                        <label className="mt-3 block">
                          <span className="field-label">Nota</span>
                          <select
                            className="field-select"
                            onChange={(event) => updateReviewDraft(installer.id, 'rating', Number(event.target.value))}
                            value={reviewDraft.rating}
                          >
                            <option value={5}>5 estrelas</option>
                            <option value={4}>4 estrelas</option>
                            <option value={3}>3 estrelas</option>
                            <option value={2}>2 estrelas</option>
                            <option value={1}>1 estrela</option>
                          </select>
                        </label>

                        <label className="mt-3 block">
                          <span className="field-label">Comentário</span>
                          <textarea
                            className="field-textarea"
                            onChange={(event) => updateReviewDraft(installer.id, 'comment', event.target.value)}
                            placeholder="Conte como foi seu atendimento"
                            rows="3"
                            value={reviewDraft.comment}
                          />
                        </label>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="gold-button" onClick={() => submitReview(installer.id)} type="button">
                            Enviar avaliação
                          </button>
                          <button className="ghost-button" onClick={() => setActiveReviewInstaller(null)} type="button">
                            Fechar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {!loading && directory.installers.length > 0 ? (
              <PaginationControls
                currentPage={normalizedInstallersPage}
                onPageChange={setInstallersPage}
                totalPages={totalInstallersPages}
              />
            ) : null}
          </div>

          <aside className="grid gap-5">
            <section className="lux-panel fade-up p-5">
              <p className="eyebrow">Ranking de instaladores</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Mais bem avaliados</h2>

              <div className="mt-4 grid gap-2">
                {directory.ranking.length ? (
                  directory.ranking.map((item) => (
                    <article
                      className="rounded-[14px] border border-[var(--line)] bg-[rgba(255,255,255,0.015)] px-3 py-3"
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
                  <div className="empty-state !p-4 text-sm">O ranking aparece quando houver avaliações suficientes.</div>
                )}
              </div>
            </section>

            <section className="lux-panel-soft fade-up rounded-[22px] p-5" style={{ animationDelay: '0.08s' }}>
              <p className="eyebrow">Avaliações recentes</p>
              <div className="mt-3 grid gap-3">
                {directory.reviews.length ? (
                  directory.reviews.map((review) => (
                    <article className="rounded-[14px] border border-[var(--line)] p-3" key={review.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{review.reviewer_name}</p>
                        <span className="status-pill" data-tone="success">
                          {review.rating}/5
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--gold-strong)]">{review.installer_name}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {review.comment || 'Avaliação enviada sem comentário adicional.'}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state !p-4 text-sm">Ainda não há avaliações recentes.</div>
                )}
              </div>
            </section>

            <section className="lux-panel-soft fade-up rounded-[22px] p-5" style={{ animationDelay: '0.1s' }}>
              <p className="eyebrow">Loja recomendada</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">{marketplace.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {marketplace.description}
              </p>
              <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--gold-strong)]">
                beminstalado.com.br
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(marketplace.highlights || []).map((highlight) => (
                  <span className="status-pill" data-tone="scheduled" key={highlight}>
                    {highlight}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                <a className="gold-button w-full justify-center" href={marketplace.url} rel="noreferrer" target="_blank">
                  {marketplace.cta_label || 'Visitar loja oficial'}
                </a>
                {marketplace.whatsapp_url ? (
                  <a className="ghost-button w-full justify-center" href={marketplace.whatsapp_url} rel="noreferrer" target="_blank">
                    Falar com a loja no WhatsApp
                  </a>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-[var(--muted)]">
                {marketplace.contact_phone ? `Contato: ${marketplace.contact_phone}` : ''}
                {marketplace.contact_phone && marketplace.contact_email ? ' • ' : ''}
                {marketplace.contact_email || ''}
              </p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
