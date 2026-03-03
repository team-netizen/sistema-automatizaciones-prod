interface HeaderProps {
    usuario?: any;
}

export function Header({ usuario }: HeaderProps) {
    const notifCount = 0;

    return (
        <header className="w-full flex items-center justify-between p-5 border-b border-[#1F2D29] bg-[#0B1412]/60 backdrop-blur-3xl sticky top-0 z-40">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">
                    <div className="w-1.5 h-4 bg-[#22C55E] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]"></div>
                    SisAutomatización
                </div>
                {usuario?.rol === 'superadmin' && (
                    <div className="px-3 py-1 rounded-full bg-[#8B7AF0]/10 border border-[#8B7AF0]/20 text-[9px] font-black text-[#8B7AF0] uppercase tracking-widest">
                        Súper Admin
                    </div>
                )}
            </div>

            <div className="flex items-center gap-6 md:gap-8">
                <div className="relative group cursor-pointer w-10 h-10 rounded-xl bg-[#1F2D29]/50 flex items-center justify-center border border-[#1F2D29] hover:border-white/20 transition-all">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-white transition-colors">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                    </svg>
                    {notifCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[9px] font-black text-white flex items-center justify-center rounded-full shadow-lg shadow-red-500/30">
                            {notifCount}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4 border-l border-[#1F2D29] pl-6 md:pl-8">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{usuario?.email}</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{usuario?.rol}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-[#0B1412] font-black text-sm shadow-lg shadow-[#22C55E]/20">
                        {usuario?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                </div>
            </div>
        </header>
    );
}
