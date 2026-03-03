interface FiltrosOperacionesProps {
    onFilterChange: (filters: any) => void;
    tipoMódulo: 'productos' | 'movimientos';
}

export const FiltrosOperaciones = ({ onFilterChange, tipoMódulo }: FiltrosOperacionesProps) => {
    return (
        <div className="flex flex-wrap items-center gap-4 bg-surface-light border border-border-color p-4 rounded-xl shadow-sm mb-6">
            <div className="flex-1 min-w-[280px]">
                <label className="block text-[11px] uppercase font-bold text-text-muted mb-2 ml-1">Búsqueda rápida</label>
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU o identificador..."
                        className="w-full h-11 bg-bg-dark border border-border-color rounded-lg px-4 pl-10 text-sm focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/20 transition-all text-text-main placeholder-text-muted/50"
                        onChange={(e) => onFilterChange({ search: e.target.value })}
                    />
                    <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-text-muted group-focus-within:text-mint transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            <div className="w-[180px]">
                <label className="block text-[11px] uppercase font-bold text-text-muted mb-2 ml-1">Canal</label>
                <select
                    className="w-full h-11 bg-bg-dark border border-border-color rounded-lg px-4 text-sm focus:outline-none focus:border-mint transition-all text-text-main appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%239CA3AF%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat"
                    onChange={(e) => onFilterChange({ sucursal: e.target.value })}
                >
                    <option value="">Todos los canales</option>
                    <option value="WEB">Tienda Web</option>
                    <option value="WSP">WhatsApp</option>
                    <option value="TIENDA">Punto de Venta</option>
                </select>
            </div>

            {tipoMódulo === 'productos' ? (
                <div className="w-[180px]">
                    <label className="block text-[11px] uppercase font-bold text-text-muted mb-2 ml-1">Disponibilidad</label>
                    <select
                        className="w-full h-11 bg-bg-dark border border-border-color rounded-lg px-4 text-sm focus:outline-none focus:border-mint transition-all text-text-main appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%239CA3AF%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat"
                        onChange={(e) => onFilterChange({ estado: e.target.value })}
                    >
                        <option value="">Cualquier stock</option>
                        <option value="normal">Stock Saludable</option>
                        <option value="bajo stock">Bajo Stock</option>
                        <option value="sin stock">Agotado</option>
                    </select>
                </div>
            ) : (
                <div className="w-[180px]">
                    <label className="block text-[11px] uppercase font-bold text-text-muted mb-2 ml-1">Naturaleza</label>
                    <select
                        className="w-full h-11 bg-bg-dark border border-border-color rounded-lg px-4 text-sm focus:outline-none focus:border-mint transition-all text-text-main appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%239CA3AF%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat"
                        onChange={(e) => onFilterChange({ tipo: e.target.value })}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="entrada">Entradas (+)</option>
                        <option value="salida">Salidas (-)</option>
                    </select>
                </div>
            )}

            <div className="flex items-end self-end h-11">
                <button
                    className="h-full px-6 bg-mint text-dark font-bold rounded-lg hover:bg-mint/90 transition-all shadow-lg shadow-mint/10 text-xs uppercase tracking-widest"
                    onClick={() => onFilterChange({ reset: true })}
                >
                    Aplicar
                </button>
            </div>
        </div>
    );
};
