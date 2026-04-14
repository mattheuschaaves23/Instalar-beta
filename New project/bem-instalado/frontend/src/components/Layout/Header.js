import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const routeCopy = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Resumo comercial e operacional da semana.',
  },
  '/clients': {
    title: 'Clientes',
    subtitle: 'Carteira de contatos, histórico e relacionamento.',
  },
  '/budgets': {
    title: 'Orçamentos',
    subtitle: 'Propostas, aprovações e envio para o cliente.',
  },
  '/budgets/new': {
    title: 'Novo orçamento',
    subtitle: 'Monte uma proposta clara, rápida e profissional.',
  },
  '/agenda': {
    title: 'Agenda',
    subtitle: 'Visual mensal com foco no dia e na execução.',
  },
  '/profile': {
    title: 'Perfil do instalador',
    subtitle: 'Dados de confiança, vitrine pública e horários vagos.',
  },
  '/subscription': {
    title: 'Assinatura',
    subtitle: 'Plano, pagamento e status de acesso.',
  },
  '/support': {
    title: 'Suporte',
    subtitle: 'Conversa direta com administrador e envio de ideias.',
  },
  '/notifications': {
    title: 'Notificações',
    subtitle: 'Tudo o que mudou no seu painel.',
  },
  '/admin': {
    title: 'Administrador',
    subtitle: 'Gestão completa da plataforma.',
  },
};

export default function Header({ onOpenMenu = () => {} }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const unread = notifications.filter((item) => !item.read).length;

  const currentCopy = routeCopy[location.pathname]
    ? routeCopy[location.pathname]
    : location.pathname.startsWith('/budgets/')
      ? routeCopy['/budgets/new']
      : routeCopy['/dashboard'];

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());

  return (
    <header className="panel-topbar border-b border-[var(--line)] bg-[rgba(8,8,7,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 md:mb-0 md:block">
            <p className="eyebrow">Painel interno</p>
            <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs md:hidden" onClick={onOpenMenu} type="button">
              Menu
            </button>
          </div>

          <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">{currentCopy.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{currentCopy.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-sm text-[var(--muted)] sm:inline-flex">
            {formattedDate}
          </span>

          <span className="rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-sm text-[var(--muted)]">
            Alertas: <strong className="text-[var(--gold-strong)]">{unread}</strong>
          </span>

          <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold-strong)]">
              {user?.name?.slice(0, 2).toUpperCase() || 'IL'}
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[10rem] truncate text-sm font-semibold text-[var(--text)]">{user?.name || 'Instalador'}</p>
              <p className="text-xs text-[var(--muted)]">Conta conectada</p>
            </div>

            <button className="ghost-button !min-h-0 !px-4 !py-2 text-xs" onClick={logout} type="button">
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
