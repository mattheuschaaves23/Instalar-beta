import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout app-layout-shell overflow-x-hidden md:flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative min-w-0 flex-1">
        <Header onOpenMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-5 lg:px-8">
          <div className="min-w-0 space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
