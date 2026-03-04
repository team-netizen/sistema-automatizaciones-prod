import React from 'react';
import { OperacionesNavbar } from '../components/OperacionesNavbar';

interface OperacionesLayoutProps {
  children: React.ReactNode;
  activeSubView: string;
  onNavigate: (view: string) => void;
  rol?: string;
}

function getSubtitleByRole(rol?: string): string {
  if (rol === 'admin_empresa') {
    return 'Gestión centralizada de logística & rendimiento operativo';
  }

  if (rol === 'encargado_sucursal') {
    return 'Panel de tu sucursal - stock, pedidos y transferencias';
  }

  if (rol === 'vendedor') {
    return 'Punto de venta';
  }

  return 'Gestión centralizada de logística & rendimiento operativo';
}

export const OperacionesLayout: React.FC<OperacionesLayoutProps> = ({
  children,
  activeSubView,
  onNavigate,
  rol,
}) => {
  return (
    <div className="w-full h-full flex flex-col px-6 md:px-10 lg:px-16 py-16 animate-fadeIn">
      <div className="w-full space-y-12">
        <div className="bg-[#111C19] border border-[#1F2D29] p-8 md:p-10 rounded-[40px] shadow-2xl shadow-black/30 overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-[24px] bg-[#22C55E]/10 flex items-center justify-center shrink-0 shadow-inner">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-[#22C55E]"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-widest uppercase">
                Centro de Operaciones
              </h1>
              <p className="text-sm text-gray-400 font-bold tracking-tight opacity-80 uppercase">
                {getSubtitleByRole(rol)}
              </p>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/5 blur-[80px] pointer-events-none"></div>
        </div>

        <OperacionesNavbar activeSubView={activeSubView} onNavigate={onNavigate} rol={rol} />

        <div className="w-full">{children}</div>
      </div>
    </div>
  );
};

