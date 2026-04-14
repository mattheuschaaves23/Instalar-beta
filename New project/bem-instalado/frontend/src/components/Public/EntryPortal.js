import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const clientPoints = ['Busca por região', 'Horários visíveis', 'Contato direto'];
const installerPoints = ['Agenda e clientes', 'Orçamentos rápidos', 'Painel profissional'];

export default function EntryPortal() {
  const { user } = useAuth();
  const installerPrimaryTo = user ? '/dashboard' : '/instalador/entrar';
  const installerPrimaryLabel = user ? 'Abrir painel' : 'Entrar';

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden px-5 py-10 md:px-8 md:py-12 lg:px-12 lg:py-16">
      <div className="entry-portal-v2">
        <header className="entry-portal-head fade-up">
          <p className="eyebrow">InstaLar</p>
          <h1 className="entry-portal-title">Escolha como você quer entrar</h1>
          <p className="entry-portal-copy">
            Um espaço para clientes encontrarem profissionais e um painel para instaladores
            organizarem o próprio negócio.
          </p>

          <div className="entry-portal-keyline">
            <span className="entry-portal-key">Pesquisa simples</span>
            <span className="entry-portal-key">Contato rápido</span>
            <span className="entry-portal-key">Gestão profissional</span>
          </div>
        </header>

        <section className="entry-portal-grid">
          <article className="entry-panel-v2 entry-panel-v2-client fade-up">
            <div className="entry-panel-v2-glow" />
            <div className="entry-panel-v2-letter" aria-hidden="true">
              C
            </div>

            <div className="entry-panel-v2-top">
              <span className="entry-panel-v2-tag">Cliente</span>
            </div>

            <div className="entry-panel-v2-body">
              <h2 className="entry-panel-v2-title">Encontrar o instalador</h2>
              <p className="entry-panel-v2-copy">
                Procure profissionais da sua região, veja horários e fale com quem faz a instalação.
              </p>

              <div className="entry-panel-v2-points">
                {clientPoints.map((item) => (
                  <span className="entry-panel-v2-point" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="entry-panel-v2-actions">
              <Link className="entry-panel-v2-primary" to="/cliente">
                Ver instaladores
              </Link>
            </div>
          </article>

          <article
            className="entry-panel-v2 entry-panel-v2-installer fade-up"
            style={{ animationDelay: '0.08s' }}
          >
            <div className="entry-panel-v2-glow" />
            <div className="entry-panel-v2-letter" aria-hidden="true">
              I
            </div>

            <div className="entry-panel-v2-top">
              <span className="entry-panel-v2-tag">Instalador</span>
            </div>

            <div className="entry-panel-v2-body">
              <h2 className="entry-panel-v2-title">Acessar o painel</h2>
              <p className="entry-panel-v2-copy">
                Centralize agenda, clientes, orçamentos e assinatura em um fluxo mais organizado.
              </p>

              <div className="entry-panel-v2-points">
                {installerPoints.map((item) => (
                  <span className="entry-panel-v2-point" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="entry-panel-v2-actions">
              <Link className="entry-panel-v2-primary entry-panel-v2-primary-dark" to={installerPrimaryTo}>
                {installerPrimaryLabel}
              </Link>
              {!user ? (
                <Link className="entry-panel-v2-secondary" to="/instalador/cadastro">
                  Criar conta
                </Link>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
