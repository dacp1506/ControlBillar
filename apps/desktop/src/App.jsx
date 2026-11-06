import { useState } from 'react';
import AdminDashboard from './views/AdminDashboard.jsx';
import ClientPortal from './views/ClientPortal.jsx';
import RemoteAdminDashboard from './views/RemoteAdminDashboard.jsx';

function DemoApp() {
  const [activeView, setActiveView] = useState('admin');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href="#" aria-label="PoolMaster inicio">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-300 text-xl font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              8
            </span>
            <span>
              <span className="block font-extrabold tracking-tight">POOLMASTER</span>
              <span className="block text-[10px] font-medium tracking-[0.2em] text-slate-400">
                CLUB &amp; LOUNGE SYSTEM
              </span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
              <span className="size-2 rounded-full bg-emerald-400" />
              Cochabamba · Bolivia
            </div>
            <nav
              aria-label="Vistas del sistema"
              className="flex rounded-xl border border-slate-800 bg-slate-950 p-1"
            >
              {[
                ['admin', 'Panel cajero'],
                ['client', 'Portal cliente'],
              ].map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={activeView === view}
                  onClick={() => setActiveView(view)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                    activeView === view
                      ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/15'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={activeView === 'admin' ? 'block' : 'hidden'}>
          <AdminDashboard />
        </div>
        <div className={activeView === 'client' ? 'block' : 'hidden'}>
          <ClientPortal />
        </div>
      </main>
    </div>
  );
}

function App() {
  return import.meta.env.VITE_BRANCH_ID ? <RemoteAdminDashboard /> : <DemoApp />;
}

export default App;
