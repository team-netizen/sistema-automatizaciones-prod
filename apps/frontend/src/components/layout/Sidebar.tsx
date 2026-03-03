import { useModuloActivo } from '../../hooks/useModuloActivo';

interface SidebarProps {
    rol?: string;
    onLogout?: () => void;
    activeView?: string;
    onNavigate?: (view: string) => void;
}

const HomeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
);
const SkillsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
);
const ZapIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);
const OperationsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /><path d="M12 22V12" /></svg>
);
const AdminIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4m-7.07-15.07 2.83 2.83m8.48 8.48 2.83 2.83M1 12h4m14 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" /></svg>
);
const LogoutIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);

export function Sidebar({ rol, onLogout, activeView = 'dashboard', onNavigate }: SidebarProps) {
    const isSuperAdmin = rol === 'superadmin';
    const { esActivo: operationsActive } = useModuloActivo('operaciones');

    const NavBtn = ({ view, icon: Icon, label, isAdmin = false, isLogout = false, onClick }: any) => (
        <button
            className={`group relative w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${activeView === view ? 'bg-[#22C55E]/10 text-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.15)]' : 'text-gray-500 hover:bg-[#1F2D29] hover:text-white'} ${isAdmin ? 'text-[#8B7AF0] hover:bg-[#8B7AF0]/10 hover:text-[#8B7AF0]' : ''} ${isLogout ? 'hover:bg-red-500/10 hover:text-red-500' : ''}`}
            data-tooltip={label}
            onClick={onClick || (() => onNavigate?.(view))}
        >
            <div className={`transition-transform duration-300 group-hover:scale-110 ${activeView === view ? 'scale-110' : ''}`}>
                <Icon />
            </div>

            {/* Active Indicator Dot */}
            {activeView === view && (
                <div className="absolute -left-1 w-1 h-6 bg-[#22C55E] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            )}

            {/* Premium Tooltip */}
            <div className="absolute left-full ml-4 px-3 py-2 bg-[#111C19] border border-[#1F2D29] rounded-xl text-[10px] font-black uppercase tracking-widest text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-2xl">
                {label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[#1F2D29]"></div>
            </div>
        </button>
    );

    return (
        <aside className="sidebar z-50">
            {/* Logo Section */}
            <div className="mb-12 relative group cursor-pointer" onClick={() => onNavigate?.('dashboard')}>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-[20px] bg-[#22C55E] flex items-center justify-center shadow-lg shadow-[#22C55E]/20 group-hover:rotate-12 transition-transform duration-500">
                    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                        <path d="M16 4C9.37 4 4 9.37 4 16C4 22.63 9.37 28 16 28C22.63 28 28 22.63 28 16" stroke="#0B1412" strokeWidth="4" strokeLinecap="round" />
                        <circle cx="22" cy="16" r="4" fill="#0B1412" />
                    </svg>
                </div>
                <div className="absolute -inset-2 bg-[#22C55E]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            {/* Main Nav */}
            <nav className="flex flex-col gap-5 w-full items-center">
                <NavBtn view="dashboard" icon={HomeIcon} label="Dashboard" />
                <NavBtn view="skills" icon={SkillsIcon} label="Habilidades" />
                <NavBtn view="executions" icon={ZapIcon} label="Ejecuciones" />
                {operationsActive && (
                    <NavBtn view="operaciones" icon={OperationsIcon} label="Operaciones" />
                )}
            </nav>

            <div className="flex-1" />

            {/* Bottom Section */}
            <div className="flex flex-col gap-5 w-full items-center mb-4">
                {isSuperAdmin && (
                    <NavBtn view="admin-companies" icon={AdminIcon} label="Empresas" isAdmin={true} />
                )}
                <div className="w-8 h-[1px] bg-[#1F2D29] my-2" />
                <NavBtn view="settings" icon={SettingsIcon} label="Ajustes" />
                <NavBtn icon={LogoutIcon} label="Salir" onClick={onLogout} isLogout={true} />
            </div>
        </aside>
    );
}
