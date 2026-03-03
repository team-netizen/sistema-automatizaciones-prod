interface AlertaProduct {
    sku: string;
    nombre: string;
    stock_total: number;
    stock_minimo: number;
}

interface AlertasStockProps {
    alertas: AlertaProduct[];
    isLoading?: boolean;
    onVerDetalle?: () => void;
}

export const AlertasStock = ({ alertas, isLoading, onVerDetalle }: AlertasStockProps) => {
    if (isLoading) {
        return (
            <div className="bg-surface border border-border-color rounded-xl p-6 animate-pulse">
                <div className="h-4 w-48 bg-bg-dark rounded mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-16 bg-bg-dark rounded-lg"></div>
                    <div className="h-16 bg-bg-dark rounded-lg"></div>
                    <div className="h-16 bg-bg-dark rounded-lg"></div>
                </div>
            </div>
        );
    }

    if (alertas.length === 0) return (
        <div className="bg-bg-dark/30 border border-border-color border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center text-lg mb-4">✅</div>
            <h4 className="text-text-main font-bold mb-1">Sin alertas pendientes</h4>
            <p className="text-sm text-text-muted">Todos tus productos están por encima del stock mínimo.</p>
        </div>
    );

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20 shadow-lg shadow-red-500/5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-text-main font-bold">Nivel Crítico de Inventario</h4>
                        <p className="text-xs text-text-muted mt-0.5">Se han detectado <span className="text-red-500 font-bold">{alertas.length} productos</span> con existencias insuficientes.</p>
                    </div>
                </div>
                <button
                    onClick={onVerDetalle}
                    className="h-9 px-4 bg-red-500/10 text-red-500 text-[10px] font-black rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
                >
                    Gestionar Todo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alertas.slice(0, 6).map((item) => (
                    <div key={item.sku} className="bg-bg-dark border border-border-color rounded-xl p-4 flex justify-between items-center group hover:border-red-500/50 transition-all">
                        <div className="flex-1 min-w-0 pr-3">
                            <p className="text-sm font-bold text-text-main truncate group-hover:text-red-500 transition-colors uppercase tracking-tight">{item.nombre}</p>
                            <p className="text-[10px] text-text-muted font-mono mt-0.5">{item.sku}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-black text-red-500 leading-none">{item.stock_total}</div>
                            <div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter mt-1">mín: {item.stock_minimo}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
