import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../Layout/AuthShell';
import PasswordField from './PasswordField';

const landingAudienceBlocks = [
  {
    kicker: 'Para cliente',
    title: 'Encontrar e comparar com segurança',
    items: ['Busque por região, compare avaliações reais e fale direto com o instalador.'],
  },
  {
    kicker: 'Para instalador',
    title: 'Operar com padrão profissional',
    items: ['Agenda, orçamento, clientes e assinatura em um painel único e organizado.'],
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', twoFactorToken: '' });
  const [needs2FA, setNeeds2FA] = useState(false);

  const submitLabel = useMemo(() => (needs2FA ? 'Validar acesso' : 'Entrar no painel'), [needs2FA]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const result = await login(form);

      if (result.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      toast.success('Acesso liberado.');
      navigate('/dashboard');
    } catch (error) {
      if (error.response?.status === 401 && error.response?.data?.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      toast.error(error.response?.data?.error || 'Não foi possível entrar.');
    }
  };

  return (
    <AuthShell
      compact
      asideCopy="Entrar"
      asideTitle="Acesso do instalador"
      description="A área de cliente abre direto na página inicial. Aqui é o login do painel profissional."
      eyebrow="InstaLar"
      highlights={[]}
      landingAudienceBlocks={landingAudienceBlocks}
      landingNote=""
      landingPoints={['Busca por região', 'Contato rápido', 'Painel profissional']}
      title="Entre no painel para organizar agenda, clientes e orçamentos."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="field-label">Email</span>
          <input
            className="field-input"
            name="email"
            onChange={handleChange}
            placeholder="seu@email.com"
            type="email"
            value={form.email}
          />
        </label>

        <PasswordField
          autoComplete="current-password"
          label="Senha"
          name="password"
          onChange={handleChange}
          placeholder="Sua senha"
          value={form.password}
        />

        {needs2FA ? (
          <label className="block">
            <span className="field-label">Código 2FA</span>
            <input
              className="field-input"
              name="twoFactorToken"
              onChange={handleChange}
              placeholder="000000"
              value={form.twoFactorToken}
            />
          </label>
        ) : null}

        <button className="gold-button w-full" type="submit">
          {submitLabel}
        </button>
      </form>

      <div className="auth-helper-card mt-5">
        <p className="text-sm text-[var(--muted)]">
          Ainda não tem conta?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/instalador/cadastro">
            Criar conta de instalador
          </Link>
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Quer apenas buscar profissionais?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/">
            Ir para área do cliente
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
