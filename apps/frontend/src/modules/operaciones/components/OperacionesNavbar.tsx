import React from 'react';

type RolUsuario = 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor';
type NavItemId =
  | 'dashboard'
  | 'productos'
  | 'sucursales'
  | 'pedidos'
  | 'transferencias'
  | 'stock'
  | 'integraciones'
  | 'movimientos'
  | 'alertas'
  | 'reportes';

interface OperacionesNavbarProps {
  activeSubView: string;
  onNavigate: (view: string) => void;
  rol?: string;
}

type NavItem = {
  id: NavItemId;
  label: string;
  adminOnly?: boolean;
  icon: React.ReactNode;
};

const IconMonitor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </svg>
);

const IconProductos = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 3 7l9 5 9-5-9-5Z" />
    <path d="M3 17l9 5 9-5" />
    <path d="M3 12l9 5 9-5" />
  </svg>
);

const IconSucursales = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V9l7-4 7 4v12" />
    <path d="M9 13h6" />
  </svg>
);

const IconPedidos = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 4h2l2.3 10.5a2 2 0 0 0 2 1.5h8.7a2 2 0 0 0 2-1.7L22 7H7" />
  </svg>
);

const IconTransferencias = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7h11" />
    <path d="m14 4 4 3-4 3" />
    <path d="M17 17H6" />
    <path d="m10 14-4 3 4 3" />
  </svg>
);

const IconStock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h10" />
  </svg>
);

const IconIntegraciones = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8.3 7.3 10.5 9.5" />
    <path d="M15.7 7.3 13.5 9.5" />
    <path d="M11.2 15.6 8 8.4" />
    <path d="M12.8 15.6 16 8.4" />
  </svg>
);

const IconMovimientos = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h12" />
    <path d="m13 4 3 3-3 3" />
    <path d="M20 17H8" />
    <path d="m11 14-3 3 3 3" />
  </svg>
);

const IconAlertas = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </svg>
);

const IconReportes = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8 16v-4" />
    <path d="M12 16V9" />
    <path d="M16 16v-7" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Monitor', adminOnly: false, icon: <IconMonitor /> },
  { id: 'productos', label: 'Productos', adminOnly: false, icon: <IconProductos /> },
  { id: 'sucursales', label: 'Sucursales', adminOnly: true, icon: <IconSucursales /> },
  { id: 'pedidos', label: 'Pedidos', adminOnly: false, icon: <IconPedidos /> },
  { id: 'transferencias', label: 'Transferencias', adminOnly: false, icon: <IconTransferencias /> },
  { id: 'stock', label: 'Stock', adminOnly: false, icon: <IconStock /> },
  { id: 'integraciones', label: 'Integraciones', adminOnly: true, icon: <IconIntegraciones /> },
  { id: 'movimientos', label: 'Movimientos', adminOnly: false, icon: <IconMovimientos /> },
  { id: 'alertas', label: 'Alertas', adminOnly: false, icon: <IconAlertas /> },
  { id: 'reportes', label: 'Reportes', adminOnly: true, icon: <IconReportes /> },
];

export const OperacionesNavbar: React.FC<OperacionesNavbarProps> = ({
  activeSubView,
  onNavigate,
  rol,
}) => {
  const role = (rol ?? '') as RolUsuario;
  const isEncargado = role === 'encargado_sucursal';
  const isVendedor = role === 'vendedor';
  const isAdmin = role === 'admin_empresa';

  const navItems = NAV_ITEMS.filter((item) => {
    if (isVendedor) return item.id === 'pedidos';
    if (isEncargado) return !item.adminOnly;
    if (isAdmin || role === 'super_admin') return true;
    return !item.adminOnly;
  });

  return (
    <div className="flex justify-center mb-12 w-full">
      <div className="inline-flex items-center gap-3 md:gap-4 bg-[#111C19] border border-[#1F2D29] rounded-[24px] p-2 shadow-2xl shadow-black/40 backdrop-blur-md overflow-x-auto max-w-full">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`group relative flex items-center gap-2.5 px-4 md:px-5 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-[18px] transition-all duration-300 outline-none whitespace-nowrap ${
              activeSubView === item.id
                ? 'bg-[#22C55E] text-[#0B1412] shadow-xl shadow-[#22C55E]/20 scale-[1.03] z-10'
                : 'text-gray-500 hover:bg-[#1F2D29] hover:text-gray-200'
            }`}
          >
            <span
              className={`transition-transform group-hover:scale-110 ${
                activeSubView === item.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
              }`}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

