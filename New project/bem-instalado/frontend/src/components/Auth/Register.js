import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../Layout/AuthShell';
import PasswordField from './PasswordField';

const highlights = [
  {
    kicker: 'Perfil público',
    title: 'Mostre seu trabalho',
    copy: 'Fotos, regiões atendidas, estilo de instalação e prova social no mesmo perfil.',
  },
  {
    kicker: 'Comercial',
    title: 'Feche mais serviços',
    copy: 'Orçamentos profissionais, PDF premium e aprovação com status claro.',
  },
  {
    kicker: 'Operação',
    title: 'Rotina organizada',
    copy: 'Agenda por dia, clientes, notificações e suporte direto no painel.',
  },
];

const PLAN_PRICE = Number(process.env.REACT_APP_SUBSCRIPTION_PRICE || 40);
const planBenefits = [
  'Dashboard com números do mês e evolução da operação.',
  'Agenda visual por dia para não perder instalação.',
  'Orçamentos com PDF profissional e histórico completo.',
  'Perfil público para atrair novos clientes.',
  'Suporte interno com chat para dúvidas e melhorias.',
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    business_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha nome, email e senha.');
      return;
    }

    if (form.password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('A confirmação de senha não confere.');
      return;
    }

    try {
      await register({
        name: form.name,
        business_name: form.business_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
      });

      toast.success('Conta criada. Agora finalize a assinatura para liberar o painel completo.');
      navigate('/subscription');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível criar a conta.');
    }
  };

  return (
    <AuthShell
      asideCopy="Criar conta"
      asideTitle="Cadastro"
      description="Seu cadastro libera um painel completo para operar com organização, imagem forte e mais conversão."
      eyebrow="InstaLar"
      highlights={highlights}
      title="Crie sua conta e transforme atendimento em operação profissional."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="field-label">Nome</span>
          <input className="field-input" name="name" onChange={handleChange} placeholder="Seu nome" value={form.name} />
        </label>

        <label className="block">
          <span className="field-label">Nome da empresa</span>
          <input
            className="field-input"
            name="business_name"
            onChange={handleChange}
            placeholder="Nome da sua marca"
            value={form.business_name}
          />
        </label>

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
          autoComplete="new-password"
          label="Senha"
          name="password"
          onChange={handleChange}
          placeholder="Crie uma senha"
          value={form.password}
        />

        <PasswordField
          autoComplete="new-password"
          label="Confirmar senha"
          name="confirmPassword"
          onChange={handleChange}
          placeholder="Repita sua senha"
          value={form.confirmPassword}
        />

        <label className="block">
          <span className="field-label">Telefone</span>
          <input
            className="field-input"
            name="phone"
            onChange={handleChange}
            placeholder="(00) 00000-0000"
            value={form.phone}
          />
        </label>

        <section className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="field-label">Plano do instalador</p>
          <p className="mt-1 text-lg font-semibold text-[var(--gold-strong)]">R$ {PLAN_PRICE.toFixed(2)}/mês</p>
          <div className="mt-3 grid gap-2">
            {planBenefits.map((benefit) => (
              <p className="text-sm text-[var(--muted)]" key={benefit}>
                • {benefit}
              </p>
            ))}
          </div>
        </section>

        <button className="gold-button w-full" type="submit">
          Criar conta
        </button>
      </form>

      <div className="auth-helper-card mt-5">
        <p className="text-sm text-[var(--muted)]">
          Já tem conta?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/instalador/entrar">
            Entrar no painel
          </Link>
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          É cliente e quer buscar profissionais?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/cliente">
            Ir para área do cliente
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
