import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { operacionesService } from '../services/operacionesService';

export const Movimientos = () => {
    const [movimientos, setMovimientos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ entradas: 0, salidas: 0, ajustes: 0 });

    useEffect(() => {
        const fetchMovimientos = async () => {
            setLoading(true);
            try {
                const response = await operacionesService.getMovimientos({});
                const data = response.data || [];
                setMovimientos(data);

                // Calcular estadísticas reales
                const newStats = data.reduce((acc: any, curr: any) => {
                    const tipo = curr.tipo?.toLowerCase();
                    if (tipo === 'entrada') acc.entradas += curr.cantidad;
                    if (tipo === 'salida') acc.salidas += curr.cantidad;
                    if (tipo === 'ajuste') acc.ajustes += 1;
                    return acc;
                }, { entradas: 0, salidas: 0, ajustes: 0 });

                setStats(newStats);
            } catch (error) {
                console.error('Error al cargar movimientos:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMovimientos();
    }, []);

    const columns = [
        { key: 'fecha', label: 'Hora / Fecha', align: 'left' as const, sortable: true },
        { key: 'tipo', label: 'Tipo Mov.', align: 'center' as const, sortable: true },
        { key: 'producto', label: 'Producto Afectado', align: 'left' as const, sortable: true },
        { key: 'cantidad', label: 'Cantidad', align: 'right' as const, sortable: true },
        { key: 'origenTarget', label: 'Origen / Canal', align: 'left' as const, sortable: true },
        { key: 'responsable', label: 'Ejecutor', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            {/* ── Metric Row ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Entradas Hoy"
                    value={stats.entradas.toString()}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                />
                <MetricCard
                    title="Salidas Hoy"
                    value={stats.salidas.toString()}
                    iconBgClass="bg-red-500/10"
                    icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
                />
                <MetricCard
                    title="Ajustes Manuales"
                    value={stats.ajustes.toString()}
                    iconBgClass="bg-orange-500/10"
                    icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                />
                <MetricCard
                    title="Promedio Diario"
                    value="0.0"
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
                />
            </div>

            {/* ── Search & Filter bar ──────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4">
                <div className="flex-1 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-[10px] flex items-center pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Filtrar por producto, origen o ejecutor..."
                            className="w-full bg-[#111C19] border border-[#1F2D29] rounded-2xl text-xs font-bold text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#22C55E]/50 transition-all tracking-wider"
                            style={{ padding: '5px 5px 5px 22px', borderLeftWidth: '5px' }}
                        />
                    </div>
                </div>
            </div>

            {/* ── High Density Movements Table ─────────────── */}
            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Historial Maestro de Stock"
                    columns={columns}
                    data={movimientos}
                    isLoading={loading}
                    totalEntries={movimientos.length}
                    accentColor="#0ea5e9"
                    renderRow={(item) => (
                        <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-white tracking-tight">{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : '---'}</span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/30 ${item.tipo?.toLowerCase() === 'entrada' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' :
                                    item.tipo?.toLowerCase() === 'salida' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                        'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                    }`}>
                                    {item.tipo || 'DESCONOCIDO'}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white group-hover:text-[#22C55E] transition-colors tracking-tight">{item.productos?.nombre || 'Producto sin nombre'}</span>
                                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Afectación Directa</span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className={`text-base font-black ${item.cantidad > 0 ? 'text-[#22C55E]' : 'text-red-500'}`}>
                                    {item.cantidad > 0 ? `+${item.cantidad}` : item.cantidad}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-left border-b border-[#1F2D29]/30">
                                <span className="text-xs font-bold text-gray-400 tracking-tight">{item.motivo || 'Sin motivo'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <div className="flex items-center justify-end gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#1F2D29] flex items-center justify-center text-[10px] font-black uppercase text-gray-500">
                                        {item.perfiles?.id ? 'U' : '?'}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sistema</span>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>
        </div>
    );
};
