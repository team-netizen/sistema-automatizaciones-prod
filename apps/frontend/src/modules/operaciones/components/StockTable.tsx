interface StockItem {
    sku: string;
    nombre: string;
    stock_web: number;
    stock_wsp: number;
    stock_total: number;
    stock_minimo: number;
}

interface StockTableProps {
    items: StockItem[];
    isLoading?: boolean;
}

export const StockTable = ({ items, isLoading }: StockTableProps) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] animate-pulse flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[#1F2D29] rounded-2xl mb-4"></div>
                <div className="h-4 w-32 bg-[#1F2D29] rounded-full"></div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="w-full h-64 bg-[#111C19] rounded-[24px] border border-[#1F2D29] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 rounded-full bg-[#0B1412] border border-[#1F2D29] flex items-center justify-center text-3xl mb-4 opacity-30">📦</div>
                <h3 className="text-sm font-black text-gray-400 tracking-tight mb-1 uppercase">Sin productos</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No se encontraron productos en inventario.</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#111C19] border border-[#1F2D29] rounded-[24px] overflow-hidden">
            <table className="w-full border-separate border-spacing-0">
                <thead className="bg-[#111C19]">
                    <tr>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">SKU</th>
                        <th className="px-6 md:px-8 py-4 text-left text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Producto</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Web</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Wsp</th>
                        <th className="px-6 md:px-8 py-4 text-right text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Stock Total</th>
                        <th className="px-6 md:px-8 py-4 text-center text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29]">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const isLowStock = item.stock_total <= item.stock_minimo;
                        return (
                            <tr key={item.sku} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                                <td className="px-6 md:px-8 py-4 border-b border-[#1F2D29]/30">
                                    <span className="font-mono text-[11px] font-black text-[#22C55E] tracking-widest uppercase">{item.sku}</span>
                                </td>
                                <td className="px-6 md:px-8 py-4 font-bold text-sm text-white border-b border-[#1F2D29]/30">{item.nombre}</td>
                                <td className="px-6 md:px-8 py-4 text-center text-sm text-gray-300 border-b border-[#1F2D29]/30">{item.stock_web}</td>
                                <td className="px-6 md:px-8 py-4 text-center text-sm text-gray-300 border-b border-[#1F2D29]/30">{item.stock_wsp}</td>
                                <td className="px-6 md:px-8 py-4 text-right font-black text-white text-sm border-b border-[#1F2D29]/30">{item.stock_total}</td>
                                <td className="px-6 md:px-8 py-4 text-center border-b border-[#1F2D29]/30">
                                    {isLowStock ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400">
                                            Bajo Stock
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#22C55E]/10 text-[#22C55E]">
                                            Normal
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
