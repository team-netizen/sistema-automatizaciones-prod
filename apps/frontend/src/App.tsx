import { useState, useEffect } from 'react';
import './index.css';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RevenueFlow } from './components/dashboard/RevenueFlow';
import { MyCard } from './components/dashboard/MyCard';
import { Transactions } from './components/dashboard/Transactions';
import { ExpenseSummary } from './components/dashboard/ExpenseSummary';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';

// Módulo de Operaciones
import { OperacionesLayout } from './modules/operaciones/layout/OperacionesLayout';
import { Dashboard as OperacionesDashboard } from './modules/operaciones/pages/Dashboard';
import { WorkerDashboard as OperacionesWorkerDashboard } from './modules/operaciones/pages/WorkerDashboard';
import { Productos as OperacionesProductos } from './modules/operaciones/pages/Productos';
import { Pedidos as OperacionesPedidos } from './modules/operaciones/pages/Pedidos';
import { Movimientos as OperacionesMovimientos } from './modules/operaciones/pages/Movimientos';
import { Alertas as OperacionesAlertas } from './modules/operaciones/pages/Alertas';
import { Reportes as OperacionesReportes } from './modules/operaciones/pages/Reportes';
import { Sucursales as OperacionesSucursales } from './modules/operaciones/pages/Sucursales';
import { ModuloGuard } from './components/guards/ModuloGuard';

function isSuperAdminRole(rol?: string): boolean {
  if (!rol) return false;
  const normalized = rol.toLowerCase().replace(/[\s_-]/g, '');
  return normalized === 'superadmin';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [activeOperacionesSubView, setActiveOperacionesSubView] = useState('dashboard');

  // Sincronizar subview de operaciones si se cambia la vista principal
  useEffect(() => {
    if (activeView === 'operaciones') {
      setActiveOperacionesSubView('dashboard');
    }
  }, [activeView]);

  // Verificar sesión
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('usuario');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUsuario(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = (data: any) => {
    setIsAuthenticated(true);
    setUsuario(data.usuario);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    setIsAuthenticated(false);
    setUsuario(null);
  };

  const renderOperacionesPage = () => {
    const isWorker = usuario?.rol?.toLowerCase() === 'operator' || usuario?.rol?.toLowerCase() === 'operador';

    switch (activeOperacionesSubView) {
      case 'dashboard':
        return isWorker ? <OperacionesWorkerDashboard /> : <OperacionesDashboard />;
      case 'productos': return <OperacionesProductos />;
      case 'sucursales':
        return isWorker ? <OperacionesWorkerDashboard /> : <OperacionesSucursales />;
      case 'pedidos': return <OperacionesPedidos />;
      case 'movimientos': return <OperacionesMovimientos />;
      case 'alertas': return <OperacionesAlertas />;
      case 'reportes':
        return isWorker ? <OperacionesWorkerDashboard /> : <OperacionesReportes />;
      default:
        return isWorker ? <OperacionesWorkerDashboard /> : <OperacionesDashboard />;
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="w-full h-full flex flex-col pl-8 pr-12 md:pr-[200px] py-16 animate-fadeIn">
            <div className="w-full space-y-16">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 text-white">
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-widest uppercase">Mi Dashboard</h1>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-3 opacity-60">Resumen operativo general</p>
                </div>
                <div className="flex gap-4">
                  <button className="h-12 px-10 rounded-2xl bg-[#22C55E] text-[#0B1412] font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-[#22C55E]/20">Resumen</button>
                  <button className="h-12 px-10 rounded-2xl bg-[#111C18] border border-white/5 text-gray-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all">Reportes</button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                <div className="xl:col-span-8 space-y-10">
                  <RevenueFlow />
                  <ExpenseSummary />
                </div>
                <div className="xl:col-span-4 space-y-10">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-50">Mi Cuenta</h3>
                    <button className="text-[9px] font-black text-[#22C55E] uppercase tracking-widest hover:underline text-white">Ver Todo</button>
                  </div>
                  <MyCard />
                  <Transactions />
                </div>
              </div>
            </div>
          </div>
        );

      case 'operaciones':
        return (
          <ModuloGuard modulo="operaciones">
            <OperacionesLayout
              rol={usuario?.rol}
              activeSubView={activeOperacionesSubView}
              onNavigate={setActiveOperacionesSubView}
            >
              <div className="w-full">
                {renderOperacionesPage()}
              </div>
            </OperacionesLayout>
          </ModuloGuard>
        );

      case 'admin-companies':
        return (
          <div className="w-full h-full flex flex-col pl-8 pr-12 md:pr-[200px] py-16 animate-fadeIn">
            <div className="w-full flex-1 flex flex-col space-y-16">
              <div>
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase mb-4">Empresas</h1>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] opacity-60">Gestión de Tenants & Infraestructura</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[#111C18] border border-white/5 p-10 rounded-[40px] shadow-2xl shadow-black/30 group hover:border-[#22C55E]/30 transition-all">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total Tenants</p>
                  <h3 className="text-5xl font-black text-white">48</h3>
                </div>
                <div className="bg-[#111C18] border border-white/5 p-10 rounded-[40px] shadow-2xl shadow-black/30 group hover:border-[#22C55E]/30 transition-all border-l-4 border-l-[#22C55E]">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Activos</p>
                  <h3 className="text-5xl font-black text-[#22C55E]">42</h3>
                </div>
                <div className="bg-[#111C18] border border-white/5 p-10 rounded-[40px] shadow-2xl shadow-black/30 group hover:border-[#22C55E]/30 transition-all border-l-4 border-l-[#8B7AF0]">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Suscripciones Pro</p>
                  <h3 className="text-5xl font-black text-[#8B7AF0]">15</h3>
                </div>
              </div>

              <div className="flex-1 bg-[#111C18] border border-white/5 rounded-[50px] p-24 flex flex-col items-center justify-center text-center shadow-inner">
                <div className="w-24 h-24 bg-[#050807] border border-white/5 rounded-3xl flex items-center justify-center text-4xl mb-10 shadow-2xl opacity-40">🏢</div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">Administrador de Tenants</h3>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-tight max-w-sm leading-loose opacity-60">Panel central para la gestión de infraestructura multi-empresa y escalabilidad global.</p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex-1 w-full px-4 md:px-10 py-24 flex flex-col items-center justify-center text-center animate-fadeIn">
            <h1 className="text-5xl md:text-7xl font-black text-white opacity-5 mb-10 tracking-widest uppercase">{activeView}</h1>
            <div className="w-20 h-1 bg-[#22C55E]/20 rounded-full mb-10"></div>
            <p className="text-sm text-gray-500 font-black tracking-widest uppercase">Módulo en construcción especializada</p>
          </div>
        );
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isSuperAdminRole(usuario?.rol)) {
    return <SuperAdminDashboard usuario={usuario} />;
  }

  return (
    <DashboardLayout
      onLogout={handleLogout}
      usuario={usuario}
      activeView={activeView}
      onNavigate={setActiveView}
    >
      <div className="flex-1 w-full overflow-y-auto">
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}

export default App;
