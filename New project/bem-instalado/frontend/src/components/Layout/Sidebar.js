import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from './BrandMark';
import BrandWordmark from './BrandWordmark';

const baseLinks = [
  { to: '/dashboard', label: 'Dashboard', kicker: 'Visão geral' },
  { to: '/cliente', label: 'Área do cliente', kicker: 'Vitrine pública' },
  { to: '/clients', label: 'Clientes', kicker: 'Relacionamento' },
  { to: '/budgets', label: 'Orçamentos', kicker: 'Comercial' },
  { to: '/agenda', label: 'Agenda', kicker: 'Operação' },
  { to: '/profile', label: 'Perfil', kicker: 'Conta e vitrine' },
  { to: '/subscription', label: 'Assinatura', kicker: 'Plano' },
  { to: '/support', label: 'Suporte', kicker: 'Chat e ideias' },
  { to: '/notifications', label: 'Notificações', kicker: 'Alertas' },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user } = useAuth();

  const links = user?.is_admin
    ? [...baseLinks, { to: '/admin', label: 'Administrador', kicker: 'Controle do sistema' }]
    : baseLinks;

  return (
    <aside
      className={`sidebar-shell ${isOpen ? 'block' : 'hidden'} border-b border-[var(--line)] bg-[rgba(9,8,7,0.94)] md:block md:w-[310px] md:border-b-0 md:border-r`}
    >
      <div className="flex min-h-full flex-col p-4 sm:p-5 md:min-h-screen md:gap-1">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <p className="eyebrow">Navegação</p>
          <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="lux-panel fade-up p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Plataforma</p>
              <BrandWordmark className="mt-2" size="lg" />
              <h1 className="sidebar-brand-title mt-3">Painel do instalador</h1>
            </div>
            <BrandMark className="sidebar-brand-badge" fallback="IL" />
          </div>

          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            Gestão completa em um só lugar: agenda, comercial, assinatura e suporte.
          </p>

          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{user?.name || 'Conta ativa'}</p>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {user?.email || 'Instalador'}
            </p>
          </div>
        </div>

        <nav className="sidebar-links mt-5 grid gap-2">
          {links.map((item, index) => (
            <NavLink
              className={({ isActive }) =>
                `fade-up lift-card rounded-[18px] border px-4 py-3 transition ${
                  isActive
                    ? 'border-[rgba(245,220,162,0.42)] bg-[rgba(200,160,88,0.1)] text-[var(--gold-strong)]'
                    : 'border-transparent bg-[rgba(255,255,255,0.015)] text-[var(--text)] hover:border-[var(--line)] hover:bg-[rgba(255,255,255,0.035)]'
                }`
              }
              key={item.to}
              onClick={onClose}
              style={{ animationDelay: `${0.05 + index * 0.04}s` }}
              to={item.to}
            >
              <p className="truncate text-sm font-semibold">{item.label}</p>
              <p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{item.kicker}</p>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
