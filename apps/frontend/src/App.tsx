import { useEffect, useState } from 'react';
import './index.css';
import { LoginPage } from './pages/LoginPage';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';
import AdminEmpresaDashboard from './components/dashboard/AdminEmpresaDashboard';
import { EncargadoDashboard } from './components/dashboard/EncargadoDashboard';
import { cerrarSesion, type PerfilUsuario, verificarSesion } from './lib/auth';
import ResetPassword from './pages/ResetPassword';

type UsuarioSesion = PerfilUsuario & {
  email?: string;
};

function isSuperAdminRole(rol?: PerfilUsuario['rol'] | null): boolean {
  return rol === 'super_admin';
}

function App() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isResetRoute = currentPath === '/reset-password' || currentPath === '/auth/callback';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [isLoadingSesion, setIsLoadingSesion] = useState(true);

  const syncSesion = async () => {
    setIsLoadingSesion(true);
    try {
      const resultado = await verificarSesion();

      if (!resultado?.perfil) {
        setIsAuthenticated(false);
        setUsuario(null);
        return;
      }

      const perfil = resultado.perfil;
      const email = resultado.session.user.email;
      const usuarioSesion: UsuarioSesion = { ...perfil, email };

      setUsuario(usuarioSesion);
      setIsAuthenticated(true);
    } finally {
      setIsLoadingSesion(false);
    }
  };

  useEffect(() => {
    if (isResetRoute) {
      setIsLoadingSesion(false);
      return;
    }
    void syncSesion();
  }, [isResetRoute]);

  const handleLoginSuccess = (_data: unknown) => {
    void syncSesion();
  };

  const handleLogout = async () => {
    await cerrarSesion();
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setUsuario(null);
  };

  if (isResetRoute) {
    return <ResetPassword />;
  }

  if (isLoadingSesion) {
    return (
      <div className="min-h-screen bg-[#0B1412] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#1F2D29] border-t-[#22C55E] rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Verificando sesion...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isSuperAdminRole(usuario?.rol)) {
    return <SuperAdminDashboard usuario={usuario ?? undefined} onLogout={handleLogout} />;
  }

  if (usuario?.rol === 'admin_empresa') {
    return <AdminEmpresaDashboard usuario={usuario} onLogout={handleLogout} />;
  }

  if (usuario?.rol === 'encargado_sucursal') {
    return <EncargadoDashboard usuario={usuario} />;
  }

  if (usuario?.rol === 'vendedor') {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: '#07090b',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ color: '#00e87b', fontFamily: 'monospace', fontSize: 24, fontWeight: 800 }}>POS</div>
        <div style={{ color: '#4d6b58', fontSize: 12 }}>Modulo Vendedor - proximamente</div>
        <button
          onClick={handleLogout}
          style={{
            marginTop: 16,
            background: 'none',
            border: '1px solid #1c2830',
            borderRadius: 8,
            padding: '8px 16px',
            color: '#4d6b58',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cerrar Sesion
        </button>
      </div>
    );
  }

  return null;
}

export default App;
