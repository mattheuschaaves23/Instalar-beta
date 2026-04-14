import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatStatusLabel,
} from '../../utils/formatters';

const defaultPricing = {
  amount: Number(process.env.REACT_APP_SUBSCRIPTION_PRICE || 40),
  currency: 'BRL',
  period: 'mensal',
  label: 'Plano instalador',
};

const defaultBenefits = [
  'Dashboard comercial completo com indicadores do mês.',
  'Agenda visual por dia para organizar instalações.',
  'Orçamentos profissionais com PDF premium.',
  'Perfil público para captar mais clientes.',
  'Suporte interno em tempo real com o administrador.',
];

export default function Subscription() {
  const [subscription, setSubscription] = useState(null);
  const [payment, setPayment] = useState(null);

  const loadSubscription = async () => {
    try {
      const response = await api.get('/subscriptions');
      setSubscription(response.data);
      setPayment(response.data.pending_payment || null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar a assinatura.');
    }
  };

  const syncPaymentStatus = async (externalId, silent = false) => {
    if (!externalId) {
      return;
    }

    try {
      const response = await api.get(`/subscriptions/payment/${externalId}`);

      if (response.data.payment) {
        setPayment(response.data);
      }

      if (response.data.status === 'paid') {
        toast.success('Pagamento confirmado. O acesso premium foi liberado.');
        setPayment(null);
        await loadSubscription();
        return;
      }

      if (!silent) {
        toast('Pagamento ainda pendente.');
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.error || 'Não foi possível consultar o pagamento.');
      }
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  useEffect(() => {
    if (!payment?.automaticConfirmation || payment?.payment?.status !== 'pending' || !payment?.payment?.external_id) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      syncPaymentStatus(payment.payment.external_id, true);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [payment?.automaticConfirmation, payment?.payment?.external_id, payment?.payment?.status]);

  const handlePay = async () => {
    try {
      const response = await api.post('/subscriptions/pay');
      setPayment(response.data);
      toast.success('PIX gerado. O acesso será liberado assim que o pagamento for confirmado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível gerar o pagamento.');
    }
  };

  const handleCheck = async () => {
    await syncPaymentStatus(payment?.payment?.external_id);
  };

  const handleCopy = async (value, message) => {
    if (!value) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        toast.success(message);
        return;
      }

      throw new Error('clipboard-unavailable');
    } catch (_error) {
      toast.error('Não foi possível copiar automaticamente. Copie manualmente o código.');
    }
  };

  const canUseApp = Boolean(subscription?.can_use_app);
  const isAutomaticMode = subscription?.payment_mode === 'automatic';
  const showRecipient = Boolean(payment?.recipientName || payment?.city);
  const pricing = subscription?.pricing || defaultPricing;
  const apiBenefits = Array.isArray(subscription?.plan_benefits) ? subscription.plan_benefits : [];
  const planBenefits = apiBenefits.length
    ? apiBenefits.map((benefit, index) => (/[\u00C3\u00C2\u00E2]/.test(String(benefit)) ? defaultBenefits[index] || benefit : benefit))
    : defaultBenefits;

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="O acesso ao sistema depende de pagamento confirmado. Sem assinatura ativa, o usuário fica limitado ao perfil e a esta tela de cobrança."
        eyebrow="Assinatura"
        stats={[
          {
            label: 'Plano',
            value: subscription?.plan ? subscription.plan.toUpperCase() : 'MENSAL',
            detail: `${formatCurrency(pricing.amount)} por ${pricing.period}.`,
          },
          {
            label: 'Status',
            value: formatStatusLabel(subscription?.status),
            detail: subscription?.expires_at
              ? `Expira em ${formatShortDate(subscription.expires_at)}`
              : 'Ainda sem data de expiração registrada.',
          },
          {
            label: 'Acesso',
            value: canUseApp ? 'LIBERADO' : 'BLOQUEADO',
            detail: canUseApp
              ? 'Ferramentas premium liberadas.'
              : 'Os módulos do painel ficam bloqueados até a confirmação do pagamento.',
          },
        ]}
        title="Pagamento confirmado é a chave para liberar o restante do painel."
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="lux-panel fade-up min-w-0 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Estado da assinatura</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Controle de acesso premium</h2>
            </div>
            <span className="status-pill" data-tone={subscription?.status}>
              {formatStatusLabel(subscription?.status)}
            </span>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
            O sistema usa a confirmação do provedor para liberar o uso. Assim que o PIX for aprovado,
            a assinatura muda para ativa e as rotas protegidas voltam a abrir.
          </p>

          <div className="mt-6 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-5">
            <p className="eyebrow">Plano e benefícios</p>
            <p className="mt-3 text-xl font-semibold text-[var(--gold-strong)]">
              {pricing.label || 'Plano instalador'} • {formatCurrency(pricing.amount)}/{pricing.period || 'mês'}
            </p>
            <div className="mt-3 grid gap-2">
              {planBenefits.map((benefit) => (
                <p className="text-sm text-[var(--muted)]" key={benefit}>
                  • {benefit}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="gold-button w-full sm:w-auto" onClick={handlePay} type="button">
              {payment ? 'Abrir PIX atual' : 'Gerar PIX mensal'}
            </button>
            {payment ? (
              <button className="ghost-button w-full sm:w-auto" onClick={handleCheck} type="button">
                Verificar pagamento
              </button>
            ) : null}
          </div>

          <div className="mt-6 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-5">
            <p className="text-sm leading-7 text-[var(--muted)]">
              {isAutomaticMode
                ? 'Validação automática ligada com Mercado Pago. Sem aprovação do provedor, o acesso continua bloqueado.'
                : 'O gateway automático ainda não foi configurado neste ambiente. Sem ele, o acesso não deve ser liberado em produção.'}
            </p>
          </div>

          {subscription?.provider_error ? (
            <div className="mt-4 break-words rounded-[22px] border border-[rgba(223,107,107,0.32)] bg-[rgba(159,47,47,0.1)] p-5 text-sm leading-7 text-[var(--text)]">
              {subscription.provider_error}
            </div>
          ) : null}
        </section>

        <aside className="grid gap-6">
          {payment ? (
            <section className="lux-panel fade-up min-w-0 p-6" style={{ animationDelay: '0.08s' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">Pagamento PIX</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Compra em aberto</h2>
                </div>
                <span className="status-pill" data-tone={payment?.payment?.status}>
                  {formatStatusLabel(payment?.payment?.status)}
                </span>
              </div>

              {payment.qrCodeImage ? (
                <img
                  alt="QR Code PIX"
                  className="mt-5 w-full rounded-[24px] border border-[var(--line)] bg-white p-4"
                  src={payment.qrCodeImage}
                />
              ) : null}

              <div className="mt-5 grid gap-3 text-sm text-[var(--muted)]">
                <div className="flex items-center justify-between rounded-[18px] border border-[var(--line)] px-4 py-3">
                  <span>Valor</span>
                  <strong className="text-[var(--text)]">{formatCurrency(payment?.payment?.amount)}</strong>
                </div>

                <div className="flex items-center justify-between rounded-[18px] border border-[var(--line)] px-4 py-3">
                  <span>Validação</span>
                  <strong className="text-[var(--text)]">Automática via provedor</strong>
                </div>

                {payment.expirationDate ? (
                  <div className="flex items-center justify-between rounded-[18px] border border-[var(--line)] px-4 py-3">
                    <span>Validade</span>
                    <strong className="text-[var(--text)]">{formatDateTime(payment.expirationDate)}</strong>
                  </div>
                ) : null}

                {showRecipient ? (
                  <div className="rounded-[18px] border border-[var(--line)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-strong)]">Recebedor</p>
                    <p className="mt-2 break-words text-[var(--text)]">
                      {[payment.recipientName, payment.city].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-[18px] border border-[var(--line)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-strong)]">Código copia e cola</p>
                  <p className="mt-2 break-all text-[var(--text)]">{payment.copyPaste}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="gold-button w-full sm:w-auto"
                  onClick={() => handleCopy(payment.copyPaste, 'Código PIX copiado.')}
                  type="button"
                >
                  Copiar código
                </button>
                {payment.ticketUrl ? (
                  <a className="ghost-button w-full sm:w-auto" href={payment.ticketUrl} rel="noreferrer" target="_blank">
                    Abrir no provedor
                  </a>
                ) : null}
                <button className="ghost-button w-full sm:w-auto" onClick={handleCheck} type="button">
                  Atualizar status
                </button>
              </div>

              <div className="mt-5 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-5">
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Depois do pagamento, o sistema consulta o provedor e só libera o uso quando o PIX estiver
                  realmente aprovado. Enquanto isso, dashboard, clientes, agenda e orçamentos permanecem bloqueados.
                </p>
              </div>
            </section>
          ) : null}

          <section className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Regra de acesso</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              O usuário pode entrar na conta, ajustar perfil e concluir o pagamento. As funcionalidades principais
              do negócio só ficam disponíveis quando a assinatura estiver ativa.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
