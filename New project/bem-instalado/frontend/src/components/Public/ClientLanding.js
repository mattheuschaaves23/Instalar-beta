import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import BrandMark from '../Layout/BrandMark';
import BrandWordmark from '../Layout/BrandWordmark';

const HERO_IMAGE_URL = '/landing/instalando-mapa-do-brasil.png';
const STORY_IMAGE_URL = '/landing/instaladores-profissionais.png';
const INSTALLER_CARDS_PER_VIEW = 4;
const REVIEW_CARDS_PER_VIEW = 4;
const STORE_CAROUSEL_INTERVAL_MS = 5200;
const INSTALLER_CAROUSEL_INTERVAL_MS = 4200;
const REVIEW_CAROUSEL_INTERVAL_MS = 5600;

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Busque sua região',
    copy: 'Digite cidade, estado ou estilo de instalação.',
  },
  {
    step: '02',
    title: 'Compare perfis',
    copy: 'Veja nota, avaliações e fotos reais.',
  },
  {
    step: '03',
    title: 'Fale e agende',
    copy: 'Converse no WhatsApp e marque o melhor horário.',
  },
];

const STORY_POINTS = [
  'Instaladores de papel de parede verificados',
  'Avaliações de clientes reais',
  'Contato direto com o profissional',
  'Perfis completos com fotos de instalações',
];

const HERO_MINI_TOPICS = [
  'Instaladores de papel de parede verificados na sua região',
  'Avaliações reais de clientes',
  'Contato direto pelo WhatsApp',
  'Horários disponíveis para instalação',
  'Suporte do início ao fim',
];

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatReviewDate(date) {
  if (!date) {
    return '';
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('pt-BR');
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return moneyFormatter.format(0);
  }
  return moneyFormatter.format(amount);
}

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getStoreCardsPerView() {
  if (typeof window === 'undefined') {
    return 3;
  }

  if (window.innerWidth <= 680) {
    return 1;
  }

  if (window.innerWidth <= 1080) {
    return 2;
  }

  return 3;
}

function RatingDots({ value }) {
  const rounded = Math.max(1, Math.round(Number(value || 0)));

  return (
    <div className="clean-stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < rounded ? 'is-on' : ''} key={index} />
      ))}
    </div>
  );
}

export default function ClientLanding() {
  const [installers, setInstallers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [storesPerView, setStoresPerView] = useState(getStoreCardsPerView);
  const [activeStoreIndex, setActiveStoreIndex] = useState(0);
  const [activeInstallerIndex, setActiveInstallerIndex] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [openedStoreCardId, setOpenedStoreCardId] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const response = await api.get('/public/installers');
        const allInstallers = response.data?.installers || [];
        const recentReviews = response.data?.reviews || [];
        const stores = response.data?.recommended_stores || [];

        const positiveReviews = recentReviews
          .filter((review) => Number(review.rating || 0) >= 4)
          .slice(0, 6);

        if (!mounted) {
          return;
        }

        setInstallers(allInstallers);
        setReviews(positiveReviews);
        setRecommendedStores(stores);
      } catch (_error) {
        if (!mounted) {
          return;
        }

        setInstallers([]);
        setReviews([]);
        setRecommendedStores([]);
      }
    };

    loadLandingData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setStoresPerView(getStoreCardsPerView());
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const topInstallers = useMemo(() => {
    const sorted = [...installers].sort((a, b) => {
        const featuredDiff = Number(Boolean(b.featured_installer)) - Number(Boolean(a.featured_installer));
        if (featuredDiff !== 0) {
          return featuredDiff;
        }

        const reviewedDiff = Number(Number(b.review_count || 0) > 0) - Number(Number(a.review_count || 0) > 0);
        if (reviewedDiff !== 0) {
          return reviewedDiff;
        }

        const ratingDiff = Number(b.average_rating || 0) - Number(a.average_rating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        const reviewCountDiff = Number(b.review_count || 0) - Number(a.review_count || 0);
        if (reviewCountDiff !== 0) {
          return reviewCountDiff;
        }

        const completedJobsDiff = Number(b.completed_jobs || 0) - Number(a.completed_jobs || 0);
        if (completedJobsDiff !== 0) {
          return completedJobsDiff;
        }

        const approvedJobsDiff = Number(b.approved_jobs || 0) - Number(a.approved_jobs || 0);
        if (approvedJobsDiff !== 0) {
          return approvedJobsDiff;
        }

        return Number(b.years_experience || 0) - Number(a.years_experience || 0);
      });

    return sorted.slice(0, 8);
  }, [installers]);

  const activeStores = useMemo(
    () => recommendedStores.filter((store) => Boolean(store?.is_active)),
    [recommendedStores]
  );

  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }, []);
  const storeCardWidth = 100 / Math.max(storesPerView, 1);
  const maxStoreIndex = useMemo(
    () => Math.max(0, activeStores.length - storesPerView),
    [activeStores.length, storesPerView]
  );
  const storeSlidePositions = useMemo(
    () => Array.from({ length: maxStoreIndex + 1 }, (_, index) => index),
    [maxStoreIndex]
  );

  const maxInstallerIndex = useMemo(
    () => Math.max(0, topInstallers.length - INSTALLER_CARDS_PER_VIEW),
    [topInstallers.length]
  );
  const installerSlidePositions = useMemo(
    () => Array.from({ length: maxInstallerIndex + 1 }, (_, index) => index),
    [maxInstallerIndex]
  );
  const installerCardWidth = 100 / INSTALLER_CARDS_PER_VIEW;
  const maxReviewIndex = useMemo(
    () => Math.max(0, reviews.length - REVIEW_CARDS_PER_VIEW),
    [reviews.length]
  );
  const reviewSlidePositions = useMemo(
    () => Array.from({ length: maxReviewIndex + 1 }, (_, index) => index),
    [maxReviewIndex]
  );
  const reviewCardWidth = 100 / REVIEW_CARDS_PER_VIEW;

  useEffect(() => {
    if (maxStoreIndex <= 0) {
      setActiveStoreIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveStoreIndex((current) => (current >= maxStoreIndex ? 0 : current + 1));
    }, STORE_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxStoreIndex]);

  useEffect(() => {
    if (activeStoreIndex > maxStoreIndex) {
      setActiveStoreIndex(0);
    }
  }, [activeStoreIndex, maxStoreIndex]);

  useEffect(() => {
    if (maxInstallerIndex <= 0) {
      setActiveInstallerIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveInstallerIndex((current) => (current >= maxInstallerIndex ? 0 : current + 1));
    }, INSTALLER_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxInstallerIndex]);

  useEffect(() => {
    if (activeInstallerIndex > maxInstallerIndex) {
      setActiveInstallerIndex(0);
    }
  }, [activeInstallerIndex, maxInstallerIndex]);

  useEffect(() => {
    if (maxReviewIndex <= 0) {
      setActiveReviewIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveReviewIndex((current) => (current >= maxReviewIndex ? 0 : current + 1));
    }, REVIEW_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxReviewIndex]);

  useEffect(() => {
    if (activeReviewIndex > maxReviewIndex) {
      setActiveReviewIndex(0);
    }
  }, [activeReviewIndex, maxReviewIndex]);

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden">
      <div className="clean-landing-shell">
        <header className="clean-landing-topbar fade-up">
          <div className="clean-landing-brand">
            <BrandMark className="client-brand-mark" />
            <div>
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p>Encontre instaladores de papel de parede perto de você.</p>
            </div>
          </div>

          <div className="clean-landing-top-actions">
            <Link className="ghost-button" to="/instalador/entrar">
              Login instalador
            </Link>
            <Link className="clean-link-action" to="/instalador/cadastro">
              Criar conta
            </Link>
          </div>
        </header>

        <section className="clean-hero fade-up" style={{ animationDelay: '0.05s' }}>
          <img
            alt="Instalador aplicando papel de parede com mapa do Brasil"
            className="clean-hero-image"
            decoding="async"
            fetchPriority="high"
            loading="eager"
            src={HERO_IMAGE_URL}
          />
          <div className="clean-hero-overlay" />

          <div className="clean-hero-content">
            <p className="eyebrow">Para clientes</p>
            <h1>
              Encontre os <span className="gold-keyword">melhores</span> instaladores de{' '}
              <span className="gold-keyword">papel de parede</span> da sua <span className="gold-keyword">região</span>.
            </h1>
            <p>
              Compare <span className="gold-keyword">avaliações reais</span> e fale direto no{' '}
              <span className="gold-keyword">WhatsApp</span>.
            </p>

            <ul className="clean-hero-topics">
              {HERO_MINI_TOPICS.map((topic, index) => (
                <li className="clean-hero-topic-item" key={topic} style={{ animationDelay: `${0.14 + index * 0.08}s` }}>
                  {topic}
                </li>
              ))}
            </ul>

            <div className="clean-hero-actions">
              <Link className="gold-button clean-cta-main" to="/cliente">
                Encontrar instaladores de papel de parede
              </Link>
            </div>
          </div>
        </section>

        <section className="clean-stores fade-up" style={{ animationDelay: '0.07s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Lojas recomendadas</p>
            <h2>Onde comprar com segurança para sua instalação</h2>
            <p>Seleção atualizada pelo administrador da plataforma com as melhores opções do momento.</p>
          </div>

          {activeStores.length > 0 ? (
            <div className="clean-stores-carousel">
              <div
                className="clean-stores-track"
                style={{ transform: `translateX(-${activeStoreIndex * storeCardWidth}%)` }}
              >
                {activeStores.map((store, index) => (
                  <article
                    className="clean-store-slide"
                    key={store.id || `${store.name}-${index}`}
                    style={{ flex: `0 0 ${storeCardWidth}%` }}
                  >
                    <div
                      className={`clean-store-card ${
                        openedStoreCardId === store.id ? 'is-open' : ''
                      }`}
                      onClick={() => {
                        if (!isTouchDevice) {
                          return;
                        }
                        setOpenedStoreCardId((current) => (current === store.id ? null : store.id));
                      }}
                      onKeyDown={(event) => {
                        if (!isTouchDevice) {
                          return;
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setOpenedStoreCardId((current) => (current === store.id ? null : store.id));
                        }
                      }}
                      role={isTouchDevice ? 'button' : undefined}
                      tabIndex={isTouchDevice ? 0 : undefined}
                    >
                      <div className="clean-store-media">
                        {store.image_url ? (
                          <img alt={store.name || 'Loja recomendada'} loading="lazy" src={store.image_url} />
                        ) : (
                          <div className="clean-store-fallback">{getInitials(store.name || 'Loja')}</div>
                        )}
                      </div>

                      <div className="clean-store-content">
                        <h3 className="clean-store-title">{store.name}</h3>
                        <div className="clean-store-reveal">
                          <p>{store.description || 'Loja recomendada para papel de parede e composição do ambiente.'}</p>
                        </div>
                        {store.link_url ? (
                          <a
                            className="clean-store-link"
                            href={store.link_url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {store.cta_label || 'Ir ao site'}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {maxStoreIndex > 0 ? (
                <div className="clean-stores-dots">
                  {storeSlidePositions.map((index) => (
                    <button
                      aria-label={`Mostrar grupo ${index + 1} de lojas recomendadas`}
                      className={index === activeStoreIndex ? 'is-active' : ''}
                      key={`store-dot-${index}`}
                      onClick={() => setActiveStoreIndex(index)}
                      type="button"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="empty-state !p-4 text-sm">As lojas recomendadas aparecerão aqui automaticamente.</div>
          )}
        </section>

        <section className="clean-story fade-up" style={{ animationDelay: '0.08s' }}>
          <div className="clean-story-text">
            <p className="eyebrow">Por que escolher</p>
            <h2>Mais clareza para decidir, mais segurança para contratar.</h2>
            <p>
              A plataforma foi feita para ser objetiva: você encontra os melhores profissionais, compara rápido e conversa
              direto com quem vai fazer a instalação.
            </p>

            <ul>
              {STORY_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>

          </div>

          <div className="clean-story-media">
            <img alt="Instaladores de papel de parede profissionais" src={STORY_IMAGE_URL} />
          </div>
        </section>

        <section className="clean-installers fade-up" style={{ animationDelay: '0.14s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Em destaque</p>
            <h2>Melhores instaladores de papel de parede da plataforma</h2>
            <p>Perfis organizados com nota, cidade, portfólio e contato direto.</p>
          </div>

          <div className="clean-installers-grid">
            {topInstallers.length > 0 ? (
              <div className="clean-installers-carousel">
                <div
                  className="clean-installers-track"
                  style={{ transform: `translateX(-${activeInstallerIndex * installerCardWidth}%)` }}
                >
                  {topInstallers.map((installer) => (
                    <article
                      className="clean-installer-slide"
                      key={installer.id}
                      style={{ flex: `0 0 ${installerCardWidth}%` }}
                    >
                      <div className="clean-installer-card">
                        <div className="clean-installer-top">
                          {installer.installer_photo ? (
                            <img
                              alt={`Foto de ${installer.display_name}`}
                              className="clean-installer-avatar"
                              src={installer.installer_photo}
                            />
                          ) : installer.logo ? (
                            <img alt={`Logo de ${installer.display_name}`} className="clean-installer-avatar" src={installer.logo} />
                          ) : (
                            <div className="clean-installer-avatar clean-installer-fallback">{getInitials(installer.display_name)}</div>
                          )}
                          <div>
                            <h3>{installer.display_name}</h3>
                            <p>{[installer.city, installer.state].filter(Boolean).join(' - ') || 'Região não informada'}</p>
                          </div>
                        </div>

                        <div className="clean-installer-rating">
                          <RatingDots value={installer.average_rating} />
                          <span>
                            {Number(installer.average_rating || 0).toFixed(1)} • {installer.review_count} avaliações
                          </span>
                        </div>

                        <div className="clean-installer-details">
                          <p>
                            <span>Método</span>
                            {installer.installation_method || 'Instalação profissional por ambiente'}
                          </p>
                          <p>
                            <span>Experiência</span>
                            {Number(installer.years_experience || 0) > 0
                              ? `${installer.years_experience} anos`
                              : 'Em atualização'}
                          </p>
                          <p>
                            <span>Atendimento</span>
                            {installer.service_hours || 'Horário informado no perfil completo'}
                          </p>
                          <p>
                            <span>Preço base</span>
                            {formatMoney(installer.base_service_cost)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {maxInstallerIndex > 0 ? (
                  <div className="clean-installers-dots">
                    {installerSlidePositions.map((index) => (
                      <button
                        aria-label={`Mostrar grupo ${index + 1} de instaladores`}
                        className={index === activeInstallerIndex ? 'is-active' : ''}
                        key={`dot-${index}`}
                        onClick={() => setActiveInstallerIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state !p-4 text-sm">Ainda não há instaladores públicos disponíveis no momento.</div>
            )}
          </div>
        </section>

        <section className="clean-reviews fade-up" style={{ animationDelay: '0.17s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Avaliações</p>
            <h2>Clientes satisfeitos com a experiência</h2>
          </div>

          <div className="clean-reviews-grid">
            {reviews.length > 0 ? (
              <div className="clean-reviews-carousel">
                <div
                  className="clean-reviews-track"
                  style={{ transform: `translateX(-${activeReviewIndex * reviewCardWidth}%)` }}
                >
                  {reviews.map((review) => (
                    <article
                      className="clean-review-slide"
                      key={review.id}
                      style={{ flex: `0 0 ${reviewCardWidth}%` }}
                    >
                      <div className="clean-review-item">
                        <div className="clean-review-head">
                          <strong>{review.reviewer_name || 'Cliente verificado'}</strong>
                          <span>{review.rating}/5</span>
                        </div>
                        <p className="clean-review-meta">
                          {review.installer_name}
                          {review.reviewer_region ? ` • ${review.reviewer_region}` : ''}
                        </p>
                        <p className="clean-review-text">{review.comment || 'Atendimento excelente e instalação impecável.'}</p>
                        <p className="clean-review-date">{formatReviewDate(review.created_at)}</p>
                      </div>
                    </article>
                  ))}
                </div>

                {maxReviewIndex > 0 ? (
                  <div className="clean-reviews-dots">
                    {reviewSlidePositions.map((index) => (
                      <button
                        aria-label={`Mostrar grupo ${index + 1} de avaliações`}
                        className={index === activeReviewIndex ? 'is-active' : ''}
                        key={`review-dot-${index}`}
                        onClick={() => setActiveReviewIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state !p-4 text-sm">As avaliações positivas aparecerão aqui automaticamente.</div>
            )}
          </div>
        </section>

        <section className="clean-how fade-up" style={{ animationDelay: '0.2s' }}>
          {HOW_IT_WORKS.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
