import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import PaginationControls from '../Layout/PaginationControls';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../../utils/formatters';

const BUDGETS_PER_PAGE = 6;

function formatToDatetimeLocal(date) {
  const safe = date instanceof Date ? date : new Date(date);
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  const hours = String(safe.getHours()).padStart(2, '0');
  const minutes = String(safe.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPaymentTerms(budget) {
  const isInstallment = Boolean(budget.installment_enabled);
  const count = Number(budget.installments_count || 1);
  const total = Number(budget.total_amount || 0);

  if (!isInstallment || count <= 1) {
    return 'Pagamento à vista';
  }

  return `${count}x de ${formatCurrency(total / count)}`;
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [approvalDraft, setApprovalDraft] = useState({ budgetId: null, scheduleDate: '' });

  const loadBudgets = async () => {
    try {
      const response = await api.get('/budgets');
      setBudgets(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar orcamentos.');
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const openApprovalModal = (budgetId) => {
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + 1);
    suggestedDate.setHours(9, 0, 0, 0);

    setApprovalDraft({
      budgetId,
      scheduleDate: formatToDatetimeLocal(suggestedDate),
    });
  };

  const closeApprovalModal = () => {
    setApprovalDraft({ budgetId: null, scheduleDate: '' });
  };

  const approveBudget = async () => {
    if (!approvalDraft.budgetId || !approvalDraft.scheduleDate) {
      toast.error('Escolha a data e a hora da instalacao.');
      return;
    }

    try {
      await api.put(`/budgets/${approvalDraft.budgetId}/approve`, {
        schedule_date: `${approvalDraft.scheduleDate.replace('T', ' ')}:00`,
      });
      toast.success('Orcamento aprovado e enviado para agenda.');
      setCurrentPage(1);
      closeApprovalModal();
      loadBudgets();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel aprovar o orcamento.');
    }
  };

  const rejectBudget = async (budgetId) => {
    try {
      await api.put(`/budgets/${budgetId}/reject`);
      toast.success('Orcamento rejeitado.');
      loadBudgets();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel rejeitar o orcamento.');
    }
  };

  const openWhatsapp = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/whatsapp`);
      window.open(response.data.link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel abrir o WhatsApp.');
    }
  };

  const downloadPdf = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orcamento-${budgetId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel gerar o PDF.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(budgets.length / BUDGETS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * BUDGETS_PER_PAGE;
  const paginatedBudgets = budgets.slice(start, start + BUDGETS_PER_PAGE);

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        actions={
          <>
            <Link className="gold-button" to="/budgets/new">
              Criar novo orçamento
            </Link>
            <Link className="ghost-button" to="/agenda">
              Ver agenda
            </Link>
          </>
        }
        description="Aqui a operacao comercial ganha clareza: acompanhe valor, status e acao ideal para cada proposta."
        eyebrow="Comercial"
        stats={[
          { label: 'Total de propostas', value: `${budgets.length}`, detail: 'Todas as propostas registradas.' },
          {
            label: 'Aprovados',
            value: `${budgets.filter((budget) => budget.status === 'approved').length}`,
            detail: 'Propostas convertidas em venda.',
          },
          {
            label: 'Pendentes',
            value: `${budgets.filter((budget) => budget.status === 'pending').length}`,
            detail: 'Oportunidades que merecem acompanhamento.',
          },
        ]}
        title="Um pipeline elegante ajuda voce a vender como consultor, nao como tirador de preco."
      />

      <article className="lux-panel-soft fade-up rounded-[24px] p-5" style={{ animationDelay: '0.04s' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Ação principal</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Criar um novo orçamento</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Use este botão para abrir direto o formulário de proposta.
            </p>
          </div>
          <Link className="gold-button w-full sm:w-auto" to="/budgets/new">
            + Criar novo orçamento
          </Link>
        </div>
      </article>

      <div className="grid gap-4">
        {paginatedBudgets.map((budget, index) => (
          <article
            className="lux-panel fade-up min-w-0 overflow-hidden p-6"
            key={budget.id}
            style={{ animationDelay: `${0.08 + index * 0.05}s` }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="break-words text-2xl font-semibold text-[var(--text)]">
                    #{budget.id} - {budget.client_name}
                  </p>
                  <span className="status-pill" data-tone={budget.status}>
                    {formatStatusLabel(budget.status)}
                  </span>
                </div>

                <div className="grid gap-2 break-words text-sm text-[var(--muted)] md:grid-cols-3">
                  <p>Criado em {formatDateTime(budget.created_at)}</p>
                  <p>Total calculado {formatCurrency(budget.total_amount)}</p>
                  <p>{formatPaymentTerms(budget)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {budget.status === 'pending' ? (
                  <>
                    <button className="gold-button w-full sm:w-auto" onClick={() => openApprovalModal(budget.id)} type="button">
                      Aprovar e agendar
                    </button>
                    <button className="danger-button w-full sm:w-auto" onClick={() => rejectBudget(budget.id)} type="button">
                      Rejeitar
                    </button>
                  </>
                ) : null}
                <button className="ghost-button w-full sm:w-auto" onClick={() => downloadPdf(budget.id)} type="button">
                  Baixar PDF
                </button>
                <button className="ghost-button w-full sm:w-auto" onClick={() => openWhatsapp(budget.id)} type="button">
                  Enviar no WhatsApp
                </button>
              </div>
            </div>
          </article>
        ))}

        {budgets.length > 0 ? (
          <PaginationControls
            currentPage={normalizedPage}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        ) : null}

        {budgets.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum orcamento cadastrado ainda. Crie o primeiro para dar vida ao seu pipeline comercial.</p>
            <div className="mt-5">
              <Link className="gold-button" to="/budgets/new">
                Criar novo orçamento
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {approvalDraft.budgetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,4,4,0.72)] px-4 backdrop-blur-md">
          <div className="lux-panel w-full max-w-lg p-6 sm:p-7">
            <p className="eyebrow">Aprovacao guiada</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Agendar instalacao</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Defina a data e a hora para a instalacao antes de aprovar o orcamento.
            </p>

            <label className="mt-6 block">
              <span className="field-label">Data e hora</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setApprovalDraft((current) => ({ ...current, scheduleDate: event.target.value }))
                }
                type="datetime-local"
                value={approvalDraft.scheduleDate}
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="gold-button w-full sm:w-auto" onClick={approveBudget} type="button">
                Confirmar aprovacao
              </button>
              <button className="ghost-button w-full sm:w-auto" onClick={closeApprovalModal} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
