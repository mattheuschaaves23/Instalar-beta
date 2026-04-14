import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatLongDate, formatShortDate } from '../../utils/formatters';
import { formatInstallationDays } from '../../utils/installerDays';

const emptyReviewForm = {
  reviewer_name: '',
  reviewer_region: '',
  rating: 5,
  comment: '',
};
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

function groupAvailabilitySlots(slots = []) {
  return slots.reduce((accumulator, slot) => {
    const dateKey = slot.slot_date;

    if (!dateKey) {
      return accumulator;
    }

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey].push(slot);
    return accumulator;
  }, {});
}

export default function InstallerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [sendingReview, setSendingReview] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get(`/public/installers/${id}`);
      setPayload(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar o perfil do instalador.');
    }
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((current) => ({
      ...current,
      [name]: name === 'rating' ? Number(value) : value,
    }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    const isOwnProfile = Boolean(user && Number(user.id) === Number(id));
    const reviewerName = reviewForm.reviewer_name.trim();

    if (!user) {
      toast.error('Faça login no painel para enviar uma avaliação.');
      return;
    }

    if (isOwnProfile) {
      toast.error('Você não pode avaliar o seu próprio perfil.');
      return;
    }

    if (!reviewerName) {
      toast.error('Informe seu nome para enviar a avaliação.');
      return;
    }

    setSendingReview(true);

    try {
      await api.post(`/public/installers/${id}/reviews`, {
        reviewer_name: reviewerName,
        reviewer_region: reviewForm.reviewer_region.trim(),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });

      toast.success('Avaliação enviada com sucesso.');
      setReviewForm(emptyReviewForm);
      await loadProfile();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar a avaliação.');
    } finally {
      setSendingReview(false);
    }
  };

  if (!payload) {
    return (
      <div className="auth-scene flex min-h-screen items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-xl p-8 text-center">
          <p className="eyebrow">Perfil público</p>
          <h1 className="page-title mt-4 text-[3rem]">Carregando instalador</h1>
          <p className="page-copy mt-4">Estamos trazendo as informações completas para você.</p>
        </div>
      </div>
    );
  }

  const { installer, reviews = [], marketplace: apiMarketplace } = payload;
  const marketplace = apiMarketplace || defaultMarketplace;
  const groupedSlots = groupAvailabilitySlots(installer.availability_slots || []);
  const groupedSlotEntries = Object.entries(groupedSlots).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const isOwnInstallerProfile = Boolean(user && Number(user.id) === Number(installer.id));

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden px-4 py-8 md:px-6 lg:px-8">
      <div className="page-shell mx-auto flex w-full max-w-6xl flex-col gap-7">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="lux-panel fade-up overflow-hidden p-7 sm:p-9 lg:p-12">
            <div className="relative z-10 min-w-0">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                {installer.installer_photo ? (
                  <img
                    alt={`Foto de ${installer.display_name}`}
                    className="h-24 w-24 rounded-full border border-[var(--line)] object-cover"
                    src={installer.installer_photo}
                  />
                ) : installer.logo ? (
                  <img
                    alt={`Logo de ${installer.display_name}`}
                    className="h-24 w-24 rounded-[28px] border border-[var(--line)] object-cover"
                    src={installer.logo}
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-[var(--line)] bg-[var(--gold-soft)] text-3xl font-bold text-[var(--gold-strong)]">
                    {getInitials(installer.display_name)}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="eyebrow">Perfil do instalador</p>
                  <h1 className="hero-title mt-4 max-w-4xl">{installer.display_name}</h1>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                    <RatingStars value={installer.average_rating} />
                    <span>{Number(installer.average_rating || 0).toFixed(1)} de nota</span>
                    <span>{installer.review_count} avaliações</span>
                    <span>{installer.unique_clients_served || 0} clientes atendidos</span>
                    <span>{installer.completed_jobs || 0} instalações concluídas</span>
                    {installer.safety?.document_masked ? (
                      <span>Documento confirmado ({installer.safety.document_masked})</span>
                    ) : null}
                  </div>
                  <p className="page-copy mt-5 max-w-3xl">
                    {installer.bio || 'Este instalador ainda está montando a apresentação pública do perfil.'}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <article className="lux-panel-soft rounded-[24px] p-5">
                  <p className="eyebrow">Região</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                    {[installer.city, installer.state].filter(Boolean).join(' - ') ||
                      installer.service_region ||
                      'Não informada'}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    Área de atendimento: {installer.service_region || 'Não informada'}
                  </p>
                </article>

                <article className="lux-panel-soft rounded-[24px] p-5">
                  <p className="eyebrow">Contato e horário</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                    {installer.service_hours || 'Horários não informados'}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    Dias de instalação: {formatInstallationDays(installer.installation_days)}
                  </p>
                </article>

                <article className="lux-panel-soft rounded-[24px] p-5">
                  <p className="eyebrow">Método</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {installer.installation_method ||
                      'O instalador ainda não descreveu o método de trabalho.'}
                  </p>
                </article>

                <article className="lux-panel-soft rounded-[24px] p-5">
                  <p className="eyebrow">Custos base</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    Visita: {formatCurrency(installer.base_service_cost)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Deslocamento: {formatCurrency(installer.travel_fee)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Preço por rolo: {formatCurrency(installer.default_price_per_roll)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Remoção: {formatCurrency(installer.default_removal_price)}
                  </p>
                </article>

              <article className="lux-panel-soft rounded-[24px] p-5 md:col-span-2">
                <p className="eyebrow">Segurança e confiança</p>
                <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
                    <p>
                      Documento:{' '}
                      {installer.safety?.document_type
                        ? installer.safety.document_type.toUpperCase()
                        : 'Não informado'}{' '}
                      {installer.safety?.document_masked ? `(${installer.safety.document_masked})` : ''}
                    </p>
                    <p>
                      Contrato:{' '}
                      {installer.safety?.accepts_service_contract ? 'fornece contrato' : 'não informado'}
                    </p>
                    <p>
                      Garantia:{' '}
                      {installer.safety?.provides_warranty
                        ? `${installer.safety.warranty_days || 0} dias`
                        : 'não informado'}
                    </p>
                    <p>
                      Contato de emergência: {installer.safety?.emergency_contact || 'não informado'}
                      {installer.safety?.emergency_phone ? ` - ${installer.safety.emergency_phone}` : ''}
                    </p>
                  </div>
                  {installer.safety?.safety_notes ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{installer.safety.safety_notes}</p>
                ) : null}
              </article>

              <article className="lux-panel-soft rounded-[24px] p-5 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="eyebrow">Portfólio visual</p>
                  <div className="flex flex-wrap gap-2">
                    {installer.featured_installer ? (
                      <span className="status-pill" data-tone="success">
                        Instalador em destaque
                      </span>
                    ) : null}
                    {installer.certificate_verified ? (
                      <span className="status-pill" data-tone="success">
                        Certificado verificado
                      </span>
                    ) : null}
                  </div>
                </div>

                {Array.isArray(installer.installation_gallery) && installer.installation_gallery.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {installer.installation_gallery.slice(0, 9).map((photo, index) => (
                      <img
                        alt={`Instalação ${index + 1} de ${installer.display_name}`}
                        className="h-40 w-full rounded-[14px] border border-[var(--line)] object-cover"
                        key={`${index}-${photo.slice(0, 24)}`}
                        src={photo}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    Este instalador ainda não adicionou fotos de instalações.
                  </p>
                )}

                {installer.certificate_file ? (
                  <div className="mt-4 rounded-[16px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      Certificado: {installer.certificate_name || 'Arquivo enviado'}
                    </p>
                    <a
                      className="gold-button mt-3 w-full justify-center sm:w-auto"
                      href={installer.certificate_file}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver certificado
                    </a>
                  </div>
                ) : null}
              </article>
            </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {installer.whatsapp_link ? (
                  <a className="gold-button" href={installer.whatsapp_link} rel="noreferrer" target="_blank">
                    Entrar em contato pelo WhatsApp
                  </a>
                ) : null}
                <a className="ghost-button" href="#avaliacoes-instalador">
                  Ver avaliações
                </a>
                {!isOwnInstallerProfile ? (
                  <a className="ghost-button" href="#avaliar-instalador">
                    Avaliar este instalador
                  </a>
                ) : null}
                <Link className="ghost-button" to="/">
                  Voltar para a busca
                </Link>
              </div>
            </div>
          </div>

          <aside className="grid gap-6">
            <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.08s' }}>
              <p className="eyebrow">Datas disponíveis</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Horários vagos do mês</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Veja abaixo os horários liberados pelo instalador para atendimento.
              </p>

              <div className="mt-5 grid gap-3">
                {groupedSlotEntries.length ? (
                  groupedSlotEntries.map(([date, slots]) => (
                    <article
                      className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4"
                      key={date}
                    >
                      <p className="text-sm font-semibold text-[var(--gold-strong)]">{formatLongDate(`${date}T12:00:00`)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slots.map((slot) => (
                          <span className="status-pill" data-tone="scheduled" key={slot.id}>
                            {slot.start_time} - {slot.end_time}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                ) : installer.available_dates?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {installer.available_dates.map((date) => (
                      <span className="status-pill" data-tone="scheduled" key={date}>
                        {formatLongDate(date)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state w-full">
                    Este instalador ainda não informou horários livres.
                  </div>
                )}
              </div>
            </section>

            <section className="lux-panel fade-up p-6" id="avaliar-instalador" style={{ animationDelay: '0.1s' }}>
              <p className="eyebrow">Avaliar instalador</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Deixe sua avaliação</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Sua avaliação ajuda outros clientes a escolher melhor.
              </p>

              {!user ? (
                <div className="empty-state mt-4 !p-4 text-sm">
                  Faça login no painel para enviar avaliação e manter a reputação da plataforma protegida.
                </div>
              ) : isOwnInstallerProfile ? (
                <div className="empty-state mt-4 !p-4 text-sm">
                  Você está visualizando o seu próprio perfil. Autoavaliações são bloqueadas por segurança.
                </div>
              ) : (
              <form className="mt-5 space-y-4" onSubmit={handleReviewSubmit}>
                <label className="block">
                  <span className="field-label">Seu nome</span>
                  <input
                    className="field-input"
                    name="reviewer_name"
                    onChange={handleReviewChange}
                    placeholder="Como você quer aparecer"
                    required
                    value={reviewForm.reviewer_name}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Sua região</span>
                  <input
                    className="field-input"
                    name="reviewer_region"
                    onChange={handleReviewChange}
                    placeholder="Cidade ou bairro"
                    value={reviewForm.reviewer_region}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Nota</span>
                  <select
                    className="field-select"
                    name="rating"
                    onChange={handleReviewChange}
                    value={reviewForm.rating}
                  >
                    <option value={5}>5 estrelas</option>
                    <option value={4}>4 estrelas</option>
                    <option value={3}>3 estrelas</option>
                    <option value={2}>2 estrelas</option>
                    <option value={1}>1 estrela</option>
                  </select>
                </label>

                <label className="block">
                  <span className="field-label">Comentário</span>
                  <textarea
                    className="field-textarea"
                    name="comment"
                    onChange={handleReviewChange}
                    placeholder="Conte como foi sua experiência"
                    rows="4"
                    value={reviewForm.comment}
                  />
                </label>

                <button className="gold-button w-full" disabled={sendingReview} type="submit">
                  {sendingReview ? 'Enviando avaliação...' : 'Enviar avaliação'}
                </button>
              </form>
              )}
            </section>

            <section className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.12s' }}>
              <p className="eyebrow">Loja recomendada</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">{marketplace?.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{marketplace?.description}</p>
              <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--gold-strong)]">
                beminstalado.com.br
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(marketplace?.highlights || []).map((highlight) => (
                  <span className="status-pill" data-tone="scheduled" key={highlight}>
                    {highlight}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                <a
                  className="gold-button w-full justify-center"
                  href={marketplace?.url || 'https://www.beminstalado.com.br'}
                  rel="noreferrer"
                  target="_blank"
                >
                  {marketplace?.cta_label || 'Visitar loja oficial'}
                </a>
                {marketplace?.whatsapp_url ? (
                  <a
                    className="ghost-button w-full justify-center"
                    href={marketplace.whatsapp_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Falar com a loja no WhatsApp
                  </a>
                ) : null}
              </div>

              <p className="mt-3 text-sm text-[var(--muted)]">
                {marketplace?.contact_phone ? `Contato: ${marketplace.contact_phone}` : ''}
                {marketplace?.contact_phone && marketplace?.contact_email ? ' • ' : ''}
                {marketplace?.contact_email || ''}
              </p>
            </section>
          </aside>
        </section>

        <section className="lux-panel fade-up p-6" id="avaliacoes-instalador" style={{ animationDelay: '0.14s' }}>
          <p className="eyebrow">Avaliações recentes</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">O que os clientes dizem</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reviews.length ? (
              reviews.map((review, index) => (
                <article
                  className="lux-panel-soft rounded-[24px] p-5"
                  key={`${review.reviewer_name}-${index}-${review.created_at}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--text)]">{review.reviewer_name}</p>
                    <span className="status-pill" data-tone="success">
                      {review.rating}/5
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--gold-strong)]">
                    {review.reviewer_region || 'Região não informada'}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {review.comment || 'Avaliação enviada sem comentário adicional.'}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {formatShortDate(review.created_at)}
                  </p>
                </article>
              ))
            ) : (
              <div className="empty-state md:col-span-2 xl:col-span-3">
                Este instalador ainda não recebeu avaliações públicas.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
