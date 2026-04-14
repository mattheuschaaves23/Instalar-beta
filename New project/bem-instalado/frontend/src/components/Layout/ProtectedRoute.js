import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-scene flex min-h-screen items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-lg p-8 text-center">
          <p className="eyebrow">InstaLar</p>
          <h1 className="page-title mt-4 text-[3rem]">Abrindo seu painel</h1>
          <p className="page-copy mt-4">
            Estamos preparando seus clientes, orçamentos e agenda para a próxima instalação.
          </p>
        </div>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate replace to="/instalador/entrar" />;
}
