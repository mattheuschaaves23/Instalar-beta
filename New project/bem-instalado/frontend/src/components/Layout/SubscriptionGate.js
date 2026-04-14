import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api from '../../services/api';

export default function SubscriptionGate() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [canUseApp, setCanUseApp] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api
      .get('/subscriptions')
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setCanUseApp(Boolean(response.data?.can_use_app));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        // Em falhas transitórias de rede/API, não bloqueia o painel à força.
        setCanUseApp(true);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="auth-scene flex min-h-[55vh] items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-lg p-8 text-center">
          <p className="eyebrow">Validando acesso</p>
          <h1 className="page-title mt-4 text-[2.8rem]">Conferindo sua assinatura</h1>
          <p className="page-copy mt-4">
            Estamos verificando seu pagamento antes de liberar as ferramentas do painel.
          </p>
        </div>
      </div>
    );
  }

  return canUseApp ? <Outlet /> : <Navigate replace state={{ from: location.pathname }} to="/subscription" />;
}
