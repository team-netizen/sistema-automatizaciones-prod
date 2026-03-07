import { NotificacionesBell } from '../dashboard/NotificacionesBell';

interface HeaderProps {
  usuario?: any;
}

function isSuperAdminRole(rol?: string): boolean {
  if (!rol) return false;
  const normalized = rol.toLowerCase().replace(/[\s_-]/g, '');
  return normalized === 'superadmin';
}

export function Header({ usuario }: HeaderProps) {
  return (
    <header className="w-full flex items-center justify-between p-5 border-b border-[#1F2D29] bg-[#0B1412]/60 backdrop-blur-3xl sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">
          <div className="w-1.5 h-4 bg-[#22C55E] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
          SisAutomatización
        </div>
        {isSuperAdminRole(usuario?.rol) && (
          <div className="px-3 py-1 rounded-full bg-[#8B7AF0]/10 border border-[#8B7AF0]/20 text-[9px] font-black text-[#8B7AF0] uppercase tracking-widest">
            Súper Admin
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 md:gap-8">
        <div className="relative group w-10 h-10 rounded-xl bg-[#1F2D29]/50 flex items-center justify-center border border-[#1F2D29] hover:border-white/20 transition-all">
          <NotificacionesBell
            iconColor="#9CA3AF"
            panelBackground="#111C19"
            panelBorder="#1F2D29"
            textColor="#FFFFFF"
            mutedColor="#9CA3AF"
            accentColor="#22C55E"
          />
        </div>

        <div className="flex items-center gap-4 border-l border-[#1F2D29] pl-6 md:pl-8">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              {usuario?.email}
            </span>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">
              {usuario?.rol}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-[#0B1412] font-black text-sm shadow-lg shadow-[#22C55E]/20">
            {usuario?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
