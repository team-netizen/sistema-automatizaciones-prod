interface Movimiento {
    id: string;
    fecha: string;
    producto: string;
    sucursal: 'WEB' | 'WSP' | 'TIENDA';
    tipo: 'entrada' | 'salida';
    cantidad: number;
    motivo: string;
}

interface MovimientosTableProps {
    movimientos: Movimiento[];
    isLoading?: boolean;
}

export const MovimientosTable = ({ movimientos, isLoading }: MovimientosTableProps) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] animate-pulse flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[#1F2D29] rounded-2xl mb-4"></div>
                <div className="h-4 w-32 bg-[#1F2D29] rounded-full"></div>
            </div>
        );
    }

    if (movimientos.length === 0) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 rounded-full bg-[#0B1412] border border-[#1F2D29] flex items-center justify-center text-3xl mb-4 opacity-30">📉</div>
                <h3 className="text-sm font-black text-gray-400 tracking-tight mb-1 uppercase">Sin movimientos</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No se registraron movimientos recientemente.</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#111C19] border border-[#1F2D29] rounded-[24px] overflow-hidden">
            <table className="w-full border-separate border-spacing-0">
                <thead className="bg-[#111C19]">
                    <tr>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Fecha</th>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Producto</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Sucursal</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Tipo</th>
                        <th className="px-6 md:px-8 py-4 text-right text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Cantidad</th>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Motivo</th>
                    </tr>
                </thead>
                <tbody>
                    {movimientos.map((mov) => (
                        <tr key={mov.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-4 text-xs text-gray-400 border-b border-[#1F2D29]/30">
                                {new Date(mov.fecha).toLocaleString()}
                            </td>
                            <td className="px-6 md:px-8 py-4 font-bold text-sm text-white border-b border-[#1F2D29]/30">{mov.producto}</td>
                            <td className="px-6 md:px-8 py-4 text-center border-b border-[#1F2D29]/30">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${mov.sucursal === 'WEB' ? 'bg-blue-500/10 text-blue-400' :
                                    mov.sucursal === 'WSP' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#8B7AF0]/10 text-[#8B7AF0]'
                                    }`}>
                                    {mov.sucursal}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-4 text-center border-b border-[#1F2D29]/30">
                                {mov.tipo === 'entrada' ? (
                                    <span className="text-[#22C55E] font-black text-xs flex items-center justify-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                        Entrada
                                    </span>
                                ) : (
                                    <span className="text-red-500 font-black text-xs flex items-center justify-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                        Salida
                                    </span>
                                )}
                            </td>
                            <td className={`px-6 md:px-8 py-4 text-right font-black text-sm border-b border-[#1F2D29]/30 ${mov.tipo === 'entrada' ? 'text-[#22C55E]' : 'text-red-500'}`}>
                                {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
                            </td>
                            <td className="px-6 md:px-8 py-4 text-xs text-gray-400 border-b border-[#1F2D29]/30">{mov.motivo}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
