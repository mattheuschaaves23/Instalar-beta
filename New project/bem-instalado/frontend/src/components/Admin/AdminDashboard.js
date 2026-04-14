import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import PageIntro from '../Layout/PageIntro';
import PaginationControls from '../Layout/PaginationControls';
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatStatusLabel,
} from '../../utils/formatters';

const initialOverview = {
  metrics: {},
  recent_users: [],
  recent_payments: [],
  recent_budgets: [],
};

const initialAnnouncement = {
  title: '',
  message: '',
  type: 'info',
};

const initialStoreForm = {
  name: '',
  description: '',
  image_url: '',
  link_url: '',
  cta_label: 'Ir ao site',
  sort_order: 0,
  is_active: true,
};

const USERS_PER_PAGE = 6;
const PAYMENTS_PER_PAGE = 6;

function formatCurrencyParts(value) {
  const parts = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(Number(value || 0));

  const currency = parts.find((item) => item.type === 'currency')?.value || 'R$';
  const integer = parts
    .filter((item) => item.type === 'integer' || item.type === 'group')
    .map((item) => item.value)
    .join('');
  const decimal = parts.find((item) => item.type === 'decimal')?.value || ',';
  const fraction = parts.find((item) => item.type === 'fraction')?.value || '00';

  return {
    currency,
    integer,
    decimal,
    fraction,
  };
}

export default function AdminDashboard() {
  const confirm = useConfirm();
  const storeFormRef = useRef(null);
  const [overview, setOverview] = useState(initialOverview);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [userFilters, setUserFilters] = useState({ q: '', status: 'all' });
  const [paymentFilters, setPaymentFilters] = useState({ q: '', status: 'all' });
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [storeForm, setStoreForm] = useState(initialStoreForm);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [savingStore, setSavingStore] = useState(false);

  const loadOverview = async () => {
    const response = await api.get('/admin/overview');
    setOverview(response.data || initialOverview);
  };

  const loadUsers = async (nextFilters = userFilters) => {
    setLoadingUsers(true);

    try {
      const response = await api.get('/admin/users', {
        params: {
          q: nextFilters.q,
          status: nextFilters.status,
          limit: 40,
        },
      });

      setUsers(response.data?.users || []);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadPayments = async (nextFilters = paymentFilters) => {
    setLoadingPayments(true);

    try {
      const response = await api.get('/admin/payments', {
        params: {
          q: nextFilters.q,
          status: nextFilters.status,
          limit: 40,
        },
      });

      setPayments(response.data?.payments || []);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadRecommendedStores = async () => {
    setLoadingStores(true);

    try {
      const response = await api.get('/admin/recommended-stores');
      setRecommendedStores(response.data?.stores || []);
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    setLoading(true);

    Promise.all([loadOverview(), loadUsers(), loadPayments(), loadRecommendedStores()])
      .catch((error) => {
        toast.error(error.response?.data?.error || 'Não foi possível carregar o painel administrativo.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUserFilterChange = (event) => {
    setUserFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handlePaymentFilterChange = (event) => {
    setPaymentFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleUserFilterSubmit = async (event) => {
    event.preventDefault();
    setUsersPage(1);

    try {
      await loadUsers(userFilters);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aplicar o filtro de usuários.');
    }
  };

  const handlePaymentFilterSubmit = async (event) => {
    event.preventDefault();
    setPaymentsPage(1);

    try {
      await loadPayments(paymentFilters);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aplicar o filtro de pagamentos.');
    }
  };

  const updatePublicProfile = async (targetUserId, nextPublicProfile) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/public-profile`, {
        public_profile: nextPublicProfile,
      });

      toast.success('Perfil público atualizado.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o perfil público.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateSubscription = async (targetUserId, nextStatus) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/subscription`, {
        status: nextStatus,
      });

      toast.success('Assinatura atualizada.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar a assinatura.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateAdminRole = async (targetUserId, nextIsAdmin) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/admin`, {
        is_admin: nextIsAdmin,
      });

      toast.success(nextIsAdmin ? 'Usuário promovido para admin.' : 'Permissão de admin removida.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível alterar permissão administrativa.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateTrust = async (targetUserId, payload) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/trust`, payload);
      toast.success('Selo de confiança atualizado.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o selo de confiança.');
    } finally {
      setSavingUserId(null);
    }
  };

  const confirmPublicProfileAction = async (targetUser) => {
    const nextPublicProfile = !targetUser.public_profile;
    const actionLabel = nextPublicProfile ? 'mostrar na vitrine pública' : 'ocultar da vitrine pública';
    const confirmed = await confirm(
      `Confirma ${actionLabel} o usuário ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updatePublicProfile(targetUser.id, nextPublicProfile);
  };

  const confirmSubscriptionAction = async (targetUser) => {
    const nextStatus = targetUser.subscription_status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'ativar a assinatura' : 'suspender a assinatura';
    const confirmed = await confirm(
      `Confirma ${actionLabel} de ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updateSubscription(targetUser.id, nextStatus);
  };

  const confirmAdminRoleAction = async (targetUser) => {
    const nextIsAdmin = !targetUser.is_admin;
    const actionLabel = nextIsAdmin ? 'tornar admin' : 'remover permissão de admin';
    const confirmed = await confirm(
      `Confirma ${actionLabel} para ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updateAdminRole(targetUser.id, nextIsAdmin);
  };

  const confirmFeaturedInstallerAction = async (targetUser) => {
    const nextFeatured = !targetUser.featured_installer;
    const actionLabel = nextFeatured ? 'destacar este instalador na vitrine' : 'remover o destaque na vitrine';
    const confirmed = await confirm(`Confirma ${actionLabel} para ${targetUser.name}?`);

    if (!confirmed) {
      return;
    }

    await updateTrust(targetUser.id, { featured_installer: nextFeatured });
  };

  const confirmCertificationAction = async (targetUser) => {
    const nextVerified = !targetUser.certification_verified;

    if (nextVerified && !targetUser.has_certificate) {
      toast.error('Este instalador ainda não enviou certificado.');
      return;
    }

    const actionLabel = nextVerified ? 'validar o certificado deste instalador' : 'remover a validação do certificado';
    const confirmed = await confirm(`Confirma ${actionLabel} para ${targetUser.name}?`);

    if (!confirmed) {
      return;
    }

    await updateTrust(targetUser.id, { certification_verified: nextVerified });
  };

  const deleteUser = async (targetUser) => {
    const confirmed = await confirm(
      `Tem certeza que deseja excluir o usuário ${targetUser.name}?\n\nEssa ação remove clientes, orçamentos e agenda vinculados.`
    );

    if (!confirmed) {
      return;
    }

    setSavingUserId(targetUser.id);

    try {
      await api.delete(`/admin/users/${targetUser.id}`);
      toast.success('Usuário removido com sucesso.');
      await Promise.all([loadUsers(userFilters), loadOverview(), loadPayments(paymentFilters)]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir o usuário.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    setSavingPaymentId(paymentId);

    try {
      await api.patch(`/admin/payments/${paymentId}/status`, { status });
      toast.success(`Pagamento marcado como ${formatStatusLabel(status).toLowerCase()}.`);
      await Promise.all([loadPayments(paymentFilters), loadOverview(), loadUsers(userFilters)]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o pagamento.');
    } finally {
      setSavingPaymentId(null);
    }
  };

  const confirmPaymentStatus = async (paymentId, status) => {
    const confirmed = await confirm(
      `Confirma alterar este pagamento para "${formatStatusLabel(status).toLowerCase()}"?`
    );

    if (!confirmed) {
      return;
    }

    await updatePaymentStatus(paymentId, status);
  };

  const handleAnnouncementChange = (event) => {
    setAnnouncement((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAnnouncementSubmit = async (event) => {
    event.preventDefault();

    if (!announcement.title.trim() || !announcement.message.trim()) {
      toast.error('Preencha título e mensagem para enviar o comunicado.');
      return;
    }

    setSendingAnnouncement(true);

    try {
      const response = await api.post('/admin/announcements', {
        title: announcement.title.trim(),
        message: announcement.message.trim(),
        type: announcement.type,
      });

      const delivered = response.data?.delivered_count || 0;
      toast.success(`Comunicado enviado para ${delivered} usuários.`);
      setAnnouncement(initialAnnouncement);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar o comunicado.');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleStoreFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setStoreForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'sort_order'
            ? Number(value)
            : value,
    }));
  };

  const resetStoreForm = () => {
    setStoreForm(initialStoreForm);
    setEditingStoreId(null);
  };

  const startStoreEdit = (store) => {
    setEditingStoreId(store.id);
    setStoreForm({
      name: store.name || '',
      description: store.description || '',
      image_url: store.image_url || '',
      link_url: store.link_url || '',
      cta_label: store.cta_label || 'Ir ao site',
      sort_order: Number(store.sort_order || 0),
      is_active: Boolean(store.is_active),
    });

    window.requestAnimationFrame(() => {
      storeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    toast.success(`Editando loja: ${store.name}`);
  };

  const handleStoreSubmit = async (event) => {
    event.preventDefault();

    if (!storeForm.name.trim()) {
      toast.error('Informe o nome da loja recomendada.');
      return;
    }

    setSavingStore(true);

    try {
      const payload = {
        name: storeForm.name.trim(),
        description: storeForm.description.trim(),
        image_url: storeForm.image_url.trim(),
        link_url: storeForm.link_url.trim(),
        cta_label: storeForm.cta_label.trim() || 'Ir ao site',
        sort_order: Number(storeForm.sort_order || 0),
        is_active: Boolean(storeForm.is_active),
      };

      if (editingStoreId) {
        await api.patch(`/admin/recommended-stores/${editingStoreId}`, payload);
        toast.success('Loja recomendada atualizada.');
      } else {
        await api.post('/admin/recommended-stores', payload);
        toast.success('Loja recomendada criada.');
      }

      await loadRecommendedStores();
      resetStoreForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar a loja recomendada.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleToggleStoreStatus = async (store) => {
    const nextStatus = !store.is_active;
    const confirmed = await confirm(
      `Confirma ${nextStatus ? 'ativar' : 'desativar'} a loja recomendada ${store.name}?`
    );

    if (!confirmed) {
      return;
    }

    setSavingStore(true);

    try {
      await api.patch(`/admin/recommended-stores/${store.id}`, { is_active: nextStatus });
      toast.success(nextStatus ? 'Loja ativada no carrossel.' : 'Loja removida do carrossel.');
      await loadRecommendedStores();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o status da loja.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteStore = async (store) => {
    const confirmed = await confirm(`Tem certeza que deseja excluir a loja recomendada ${store.name}?`);

    if (!confirmed) {
      return;
    }

    setSavingStore(true);

    try {
      await api.delete(`/admin/recommended-stores/${store.id}`);
      toast.success('Loja recomendada removida.');
      await loadRecommendedStores();

      if (editingStoreId === store.id) {
        resetStoreForm();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir a loja recomendada.');
    } finally {
      setSavingStore(false);
    }
  };

  const metrics = overview.metrics || {};
  const paidMonthMetric = formatCurrencyParts(metrics.paid_this_month_total || 0);
  const totalUsersPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const normalizedUsersPage = Math.min(usersPage, totalUsersPages);
  const usersStart = (normalizedUsersPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = users.slice(usersStart, usersStart + USERS_PER_PAGE);

  const totalPaymentsPages = Math.max(1, Math.ceil(payments.length / PAYMENTS_PER_PAGE));
  const normalizedPaymentsPage = Math.min(paymentsPage, totalPaymentsPages);
  const paymentsStart = (normalizedPaymentsPage - 1) * PAYMENTS_PER_PAGE;
  const paginatedPayments = payments.slice(paymentsStart, paymentsStart + PAYMENTS_PER_PAGE);

  if (loading) {
    return (
      <section className="page-shell space-y-7">
        <div className="empty-state">Carregando painel administrativo...</div>
      </section>
    );
  }

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="Área exclusiva do criador para acompanhar operação, assinaturas, pagamentos, confiança dos perfis e comunicados globais da plataforma."
        eyebrow="Administrador"
        stats={[
          {
            label: 'Usuários totais',
            value: `${metrics.total_users || 0}`,
            detail: `${metrics.new_users_last_30_days || 0} novos nos últimos 30 dias.`,
          },
          {
            label: 'Assinaturas ativas',
            value: `${metrics.active_subscriptions || 0}`,
            detail: `${metrics.inactive_subscriptions || 0} inativas.`,
          },
          {
            label: 'Receita do mes',
            value: formatCurrency(metrics.monthly_revenue || 0),
            detail: `${metrics.paid_this_month_count || 0} pagamentos confirmados.`,
          },
        ]}
        title="Painel administrativo do criador"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="grid gap-6">
          <article className="lux-panel fade-up p-6">
            <p className="eyebrow">Métricas da plataforma</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Instaladores públicos</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.public_installers || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admins ativos</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.total_admins || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pagamentos pendentes</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.pending_payments || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Orçamentos aprovados</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.approved_budgets || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Orçamentos pendentes</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.pending_budgets || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pagamentos do mês</p>
                <div className="admin-money mt-2">
                  <span className="admin-money-currency">{paidMonthMetric.currency}</span>
                  <span className="admin-money-integer">{paidMonthMetric.integer}</span>
                  <span className="admin-money-fraction">
                    {paidMonthMetric.decimal}
                    {paidMonthMetric.fraction}
                  </span>
                </div>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Instaladores em destaque</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.featured_installers || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Certificados verificados</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.certified_installers || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Suporte aberto</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.support_open_conversations || 0}</p>
              </article>

              <article className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Ideias pendentes</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.support_pending_ideas || 0}</p>
              </article>
            </div>
          </article>

          <article className="lux-panel fade-up p-6" style={{ animationDelay: '0.06s' }}>
            <p className="eyebrow">Atividade recente</p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <section className="rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">Novos usuários</p>

                <div className="mt-3 grid gap-3">
                  {(overview.recent_users || []).map((item) => (
                    <div key={item.id}>
                      <p className="text-sm text-[var(--text)]">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">{item.email}</p>
                      <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">Pagamentos</p>

                <div className="mt-3 grid gap-3">
                  {(overview.recent_payments || []).map((item) => (
                    <div key={item.id}>
                      <p className="text-sm text-[var(--text)]">{item.user_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatCurrency(item.amount)} • {formatStatusLabel(item.status)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">Orçamentos</p>

                <div className="mt-3 grid gap-3">
                  {(overview.recent_budgets || []).map((item) => (
                    <div key={item.id}>
                      <p className="text-sm text-[var(--text)]">
                        #{item.id} • {item.installer_name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.client_name} • {formatStatusLabel(item.status)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{formatCurrency(item.total_amount)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </article>

          <article className="lux-panel fade-up p-6" style={{ animationDelay: '0.08s' }}>
            <p className="eyebrow">Gestão de pagamentos</p>

            <form className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]" onSubmit={handlePaymentFilterSubmit}>
              <input
                className="field-input"
                name="q"
                onChange={handlePaymentFilterChange}
                placeholder="Buscar por nome, email ou ID externo"
                value={paymentFilters.q}
              />

              <select
                className="field-select"
                name="status"
                onChange={handlePaymentFilterChange}
                value={paymentFilters.status}
              >
                <option value="all">Todos os status</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagos</option>
                <option value="failed">Falhos</option>
                <option value="canceled">Cancelados</option>
              </select>

              <button className="ghost-button" type="submit">
                Filtrar
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingPayments ? <div className="empty-state">Atualizando pagamentos...</div> : null}

              {!loadingPayments && payments.length === 0 ? (
                <div className="empty-state">Nenhum pagamento encontrado com esse filtro.</div>
              ) : null}

              {paginatedPayments.map((item) => (
                <article
                  className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{item.user_name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{item.user_email}</p>
                      <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                    </div>

                    <span className="status-pill" data-tone={item.status}>
                      {formatStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
                    <p>Valor: {formatCurrency(item.amount)}</p>
                    <p>Metodo: {item.method || '-'}</p>
                    <p>Provedor: {item.provider || '-'}</p>
                    <p>ID externo: {item.external_id || '-'}</p>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      className="gold-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingPaymentId === item.id}
                      onClick={() => confirmPaymentStatus(item.id, 'paid')}
                      type="button"
                    >
                      Marcar pago
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingPaymentId === item.id}
                      onClick={() => confirmPaymentStatus(item.id, 'pending')}
                      type="button"
                    >
                      Voltar pendente
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingPaymentId === item.id}
                      onClick={() => confirmPaymentStatus(item.id, 'failed')}
                      type="button"
                    >
                      Marcar falha
                    </button>

                    <button
                      className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingPaymentId === item.id}
                      onClick={() => confirmPaymentStatus(item.id, 'canceled')}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </div>
                </article>
              ))}

              {payments.length > 0 ? (
                <PaginationControls
                  currentPage={normalizedPaymentsPage}
                  onPageChange={setPaymentsPage}
                  totalPages={totalPaymentsPages}
                />
              ) : null}
            </div>
          </article>
        </section>

        <aside className="grid gap-6">
          <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.1s' }}>
            <p className="eyebrow">Gestão de usuários</p>

            <form className="mt-5 grid gap-3" onSubmit={handleUserFilterSubmit}>
              <input
                className="field-input"
                name="q"
                onChange={handleUserFilterChange}
                placeholder="Buscar por nome ou email"
                value={userFilters.q}
              />

              <select
                className="field-select"
                name="status"
                onChange={handleUserFilterChange}
                value={userFilters.status}
              >
                <option value="all">Todos os status</option>
                <option value="active">Assinatura ativa</option>
                <option value="inactive">Assinatura inativa</option>
                <option value="canceled">Assinatura cancelada</option>
              </select>

              <button className="ghost-button w-full" type="submit">
                Aplicar filtros
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingUsers ? <div className="empty-state">Atualizando usuários...</div> : null}

              {!loadingUsers && users.length === 0 ? (
                <div className="empty-state">Nenhum usuário encontrado com esse filtro.</div>
              ) : null}

              {paginatedUsers.map((item) => (
                <article
                  className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{item.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{item.email}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Criado em {formatShortDate(item.created_at)}</p>
                  </div>

                    <span className="status-pill" data-tone={item.subscription_status}>
                      {formatStatusLabel(item.subscription_status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
                    <p>Orçamentos: {item.budgets_count}</p>
                    <p>Aprovados: {item.approved_count}</p>
                    <p>Perfil público: {item.public_profile ? 'Sim' : 'Não'}</p>
                    <p>Certificado enviado: {item.has_certificate ? 'Sim' : 'Não'}</p>
                    <p>Certificado verificado: {item.certification_verified ? 'Sim' : 'Não'}</p>
                    <p>Destaque na vitrine: {item.featured_installer ? 'Sim' : 'Não'}</p>
                    <p>Admin: {item.is_admin ? 'Sim' : 'Não'}</p>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id}
                      onClick={() => confirmPublicProfileAction(item)}
                      type="button"
                    >
                      {item.public_profile ? 'Ocultar vitrine' : 'Mostrar na vitrine'}
                    </button>

                    <button
                      className="gold-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id}
                      onClick={() => confirmSubscriptionAction(item)}
                      type="button"
                    >
                      {item.subscription_status === 'active' ? 'Suspender assinatura' : 'Ativar assinatura'}
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id}
                      onClick={() => confirmFeaturedInstallerAction(item)}
                      type="button"
                    >
                      {item.featured_installer ? 'Remover destaque' : 'Destacar instalador'}
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || (!item.has_certificate && !item.certification_verified)}
                      onClick={() => confirmCertificationAction(item)}
                      type="button"
                    >
                      {item.certification_verified ? 'Remover selo certificado' : 'Validar certificado'}
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id}
                      onClick={() => confirmAdminRoleAction(item)}
                      type="button"
                    >
                      {item.is_admin ? 'Remover admin' : 'Tornar admin'}
                    </button>

                    <button
                      className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id}
                      onClick={() => deleteUser(item)}
                      type="button"
                    >
                      Excluir usuário
                    </button>
                  </div>
                </article>
              ))}

              {users.length > 0 ? (
                <PaginationControls
                  currentPage={normalizedUsersPage}
                  onPageChange={setUsersPage}
                  totalPages={totalUsersPages}
                />
              ) : null}
            </div>
          </section>

          <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.12s' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Lojas recomendadas</p>
              {editingStoreId ? (
                <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={resetStoreForm} type="button">
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <form className="mt-5 grid gap-3" onSubmit={handleStoreSubmit} ref={storeFormRef}>
              <input
                autoFocus={Boolean(editingStoreId)}
                className="field-input"
                name="name"
                onChange={handleStoreFormChange}
                placeholder="Nome da loja"
                value={storeForm.name}
              />

              <textarea
                className="field-textarea"
                name="description"
                onChange={handleStoreFormChange}
                placeholder="Descrição curta para aparecer no carrossel"
                rows={3}
                value={storeForm.description}
              />

              <input
                className="field-input"
                name="image_url"
                onChange={handleStoreFormChange}
                placeholder="URL da imagem"
                value={storeForm.image_url}
              />

              <input
                className="field-input"
                name="link_url"
                onChange={handleStoreFormChange}
                placeholder="URL de destino da loja"
                value={storeForm.link_url}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field-input"
                  name="cta_label"
                  onChange={handleStoreFormChange}
                  placeholder="Texto do botão (ex: Visitar loja)"
                  value={storeForm.cta_label}
                />

                <input
                  className="field-input"
                  min={-99}
                  name="sort_order"
                  onChange={handleStoreFormChange}
                  placeholder="Ordem de exibição"
                  type="number"
                  value={storeForm.sort_order}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  checked={storeForm.is_active}
                  name="is_active"
                  onChange={handleStoreFormChange}
                  type="checkbox"
                />
                Mostrar no carrossel público
              </label>

              <button className="gold-button w-full" disabled={savingStore} type="submit">
                {savingStore
                  ? 'Salvando...'
                  : editingStoreId
                    ? 'Atualizar loja recomendada'
                    : 'Adicionar loja recomendada'}
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingStores ? <div className="empty-state">Carregando lojas recomendadas...</div> : null}

              {!loadingStores && recommendedStores.length === 0 ? (
                <div className="empty-state">Nenhuma loja recomendada cadastrada ainda.</div>
              ) : null}

              {recommendedStores.map((store) => (
                <article
                  className={`admin-store-card rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4 ${
                    editingStoreId === store.id ? 'admin-store-card-editing' : ''
                  }`}
                  key={store.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{store.name}</p>
                      <p className="text-xs text-[var(--muted)]">Ordem: {store.sort_order}</p>
                    </div>

                    <span className="status-pill" data-tone={store.is_active ? 'paid' : 'canceled'}>
                      {store.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {editingStoreId === store.id ? (
                    <p className="admin-store-editing-note mt-2">Modo edição ativo</p>
                  ) : null}

                  {store.image_url ? (
                    <div className="admin-store-preview mt-3">
                      <img alt={`Preview da loja ${store.name}`} loading="lazy" src={store.image_url} />
                    </div>
                  ) : null}

                  {store.description ? (
                    <p className="admin-store-description mt-3 text-sm text-[var(--muted)]">{store.description}</p>
                  ) : null}

                  <div className="admin-store-meta mt-3 grid gap-1 text-xs text-[var(--muted)]">
                    <p>Imagem: {store.image_url || '-'}</p>
                    <p>Link: {store.link_url || '-'}</p>
                    <p>CTA: {store.cta_label || 'Ir ao site'}</p>
                  </div>

                  <div className="admin-store-actions mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => startStoreEdit(store)}
                      type="button"
                    >
                      Editar
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => handleToggleStoreStatus(store)}
                      type="button"
                    >
                      {store.is_active ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => handleDeleteStore(store)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Comunicado global</p>

            <form className="mt-5 grid gap-3" onSubmit={handleAnnouncementSubmit}>
              <input
                className="field-input"
                name="title"
                onChange={handleAnnouncementChange}
                placeholder="Título do comunicado"
                value={announcement.title}
              />

              <select
                className="field-select"
                name="type"
                onChange={handleAnnouncementChange}
                value={announcement.type}
              >
                <option value="info">Informação</option>
                <option value="success">Sucesso</option>
                <option value="warning">Aviso</option>
              </select>

              <textarea
                className="field-textarea"
                name="message"
                onChange={handleAnnouncementChange}
                placeholder="Mensagem que será enviada para todos os usuários"
                rows={4}
                value={announcement.message}
              />

              <button className="gold-button w-full" disabled={sendingAnnouncement} type="submit">
                {sendingAnnouncement ? 'Enviando...' : 'Enviar para todos'}
              </button>
            </form>
          </section>
        </aside>
      </div>
    </section>
  );
}
