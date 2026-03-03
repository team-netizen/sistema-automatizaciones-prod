interface Pedido {
    id: string;
    order_id_externo: string;
    origen: string;
    total: number;
    fecha: string;
    estado: string;
}

interface PedidosTableProps {
    pedidos: Pedido[];
    isLoading?: boolean;
}

export const PedidosTable = ({ pedidos, isLoading }: PedidosTableProps) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] animate-pulse flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[#1F2D29] rounded-2xl mb-4"></div>
                <div className="h-4 w-32 bg-[#1F2D29] rounded-full"></div>
            </div>
        );
    }

    if (pedidos.length === 0) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 rounded-full bg-[#0B1412] border border-[#1F2D29] flex items-center justify-center text-3xl mb-4 opacity-30">🛒</div>
                <h3 className="text-sm font-black text-gray-400 tracking-tight mb-1 uppercase">Sin pedidos recientes</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No se han sincronizado pedidos en las últimas 24 horas.</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#111C19] border border-[#1F2D29] rounded-[24px] overflow-hidden">
            <table className="w-full border-separate border-spacing-0">
                <thead className="bg-[#111C19]">
                    <tr>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">ID Transacción</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Canal Origen</th>
                        <th className="px-6 md:px-8 py-4 text-right text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Monto Total</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Fecha Sinc.</th>
                        <th className="px-6 md:px-8 py-4 text-right text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {pedidos.map((pedido) => {
                        const origen = String(pedido.origen ?? '').toLowerCase();
                        const estado = String(pedido.estado ?? '').toLowerCase();

                        return (
                        <tr key={pedido.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className="font-mono text-[11px] font-black text-[#22C55E] tracking-widest uppercase">{pedido.order_id_externo}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${origen.includes('woo') ? 'bg-[#8B7AF0]/10 text-[#8B7AF0]' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                    {pedido.origen}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className="font-black text-white text-base">${pedido.total.toFixed(2)}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className="text-xs font-bold text-gray-400 tracking-tight">{new Date(pedido.fecha).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${estado.includes('comple') ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                                    estado.includes('pend') ? 'bg-orange-500/10 text-orange-400' :
                                        'bg-red-500/10 text-red-500'
                                    }`}>
                                    {pedido.estado}
                                </span>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
