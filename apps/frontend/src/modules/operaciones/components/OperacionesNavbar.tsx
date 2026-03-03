import React from 'react';

interface OperacionesNavbarProps {
    activeSubView: string;
    onNavigate: (view: string) => void;
    rol?: string;
}

export const OperacionesNavbar: React.FC<OperacionesNavbarProps> = ({ activeSubView, onNavigate, rol }) => {
    const isWorker = rol?.toLowerCase() === 'operator';

    const navItems = [
        { id: 'dashboard', label: 'Monitor', icon: '📊' },
        { id: 'productos', label: 'Productos', icon: '📦' },
        { id: 'sucursales', label: 'Sucursales', icon: '🏪', adminOnly: true },
        { id: 'pedidos', label: 'Pedidos', icon: '🛒' },
        { id: 'movimientos', label: 'Movimientos', icon: '⟳' },
        { id: 'alertas', label: 'Alertas', icon: '⚠️' },
        { id: 'reportes', label: 'Reportes', icon: '📈', adminOnly: true },
    ].filter(item => !isWorker || !item.adminOnly);

    return (
        <div className="flex justify-center mb-12 w-full">
            <div className="inline-flex items-center gap-6 bg-[#111C19] border border-[#1F2D29] rounded-[24px] p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`group relative flex items-center gap-2.5 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-[18px] transition-all duration-400 outline-none ${activeSubView === item.id
                            ? 'bg-[#22C55E] text-[#0B1412] shadow-xl shadow-[#22C55E]/20 scale-105 z-10'
                            : 'text-gray-500 hover:bg-[#1F2D29] hover:text-gray-200'
                            }`}
                    >
                        <span className={`text-base transition-transform group-hover:scale-110 ${activeSubView === item.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                            {item.icon}
                        </span>
                        <span className="whitespace-nowrap">
                            {item.label}
                        </span>
                        {/* Underline or dot could go here if needed */}
                    </button>
                ))}
            </div>
        </div>
    );
};
