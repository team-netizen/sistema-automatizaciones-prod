import { useEffect, useState } from 'react';
import './index.css';
import { LoginPage } from './pages/LoginPage';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';
import AdminEmpresaDashboard from './components/dashboard/AdminEmpresaDashboard';
import { EncargadoDashboard } from './components/dashboard/EncargadoDashboard';
import VendedorDashboard from './components/dashboard/VendedorDashboard';
import { cerrarSesion, type PerfilUsuario, verificarSesion } from './lib/auth';
import ResetPassword from './pages/ResetPassword';

type UsuarioSesion = PerfilUsuario & {
  email?: string;
  nombre?: string;
  sucursal_nombre?: string;
};

function getNombreSesion(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;

  const row = metadata as Record<string, unknown>;
  const candidates = [row.nombre, row.full_name, row.name];
  const nombre = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);

  return typeof nombre === 'string' ? nombre : undefined;
}

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
      const nombre = getNombreSesion(resultado.session.user.user_metadata);
      const usuarioSesion: UsuarioSesion = {
        ...perfil,
        email,
        nombre,
        sucursal_nombre: perfil.sucursal_nombre || 'Mi sucursal',
      };

      sessionStorage.setItem('usuario', JSON.stringify(usuarioSesion));
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
    localStorage.clear();
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUsuario(null);
    window.location.replace('/');
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
    return (
      <SuperAdminDashboard
        usuario={{
          id: usuario?.id || '',
          email: usuario?.email || '',
          rol: usuario?.rol || 'super_admin',
          empresa_id: usuario?.empresa_id || null,
        }}
        token={sessionStorage.getItem('access_token') || ''}
        apiBase="https://sistema-automatizaciones-backend.onrender.com"
        onLogout={handleLogout}
      />
    );
  }

  if (usuario?.rol === 'admin_empresa') {
    return <AdminEmpresaDashboard usuario={usuario} onLogout={handleLogout} />;
  }

  if (usuario?.rol === 'encargado_sucursal') {
    return <EncargadoDashboard usuario={usuario} onLogout={handleLogout} />;
  }

  if (usuario?.rol === 'vendedor') {
    return (
      <VendedorDashboard
        usuario={{
          id: usuario.id,
          nombre: usuario.nombre || usuario.email || 'Vendedor',
          email: usuario.email || '',
          rol: usuario.rol,
          empresa_id: usuario.empresa_id || '',
          sucursal_id: usuario.sucursal_id || '',
          sucursal_nombre: usuario.sucursal_nombre || 'Mi sucursal',
        }}
        token={sessionStorage.getItem('access_token') || ''}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}

export default App;
