import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { operacionesService } from '../services/operacionesService';

export const Dashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const data = await operacionesService.getDashboardMetrics();
                setStats(data);
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const columns = [
        { key: 'sku', label: 'SKU', align: 'left' as const, sortable: true },
        { key: 'nombre', label: 'Producto', align: 'left' as const, sortable: true },
        { key: 'stock_web', label: 'Web', align: 'center' as const, sortable: true },
        { key: 'stock_wsp', label: 'WhatsApp', align: 'center' as const, sortable: true },
        { key: 'stock_total', label: 'Total', align: 'right' as const, sortable: true },
        { key: 'estado', label: 'Estado', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            {/* ═══════════ ROW 1: Metrics ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    isLoading={loading}
                    title="Surtido Total"
                    value={stats?.metricas?.total_productos || '0'}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                />
                <MetricCard
                    isLoading={loading}
                    title="Pedidos del Mes"
                    value={stats?.metricas?.pedidos_mes || '0'}
                    iconBgClass="bg-[#8B7AF0]/10"
                    icon={<svg className="w-5 h-5 text-[#8B7AF0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                />
                <MetricCard
                    isLoading={loading}
                    title="Movimientos (7d)"
                    value={stats?.metricas?.movimientos_recientes || '0'}
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l-4-4" /></svg>}
                />
                <MetricCard
                    isLoading={loading}
                    title="Alertas Activas"
                    value={stats?.metricas?.alertas_activas || '0'}
                    iconBgClass="bg-red-500/10"
                    icon={<svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                />
            </div>

            {/* ═══════════ ROW 2: Info + Chart (Side by Side) ═══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Info Panel */}
                <div className="lg:col-span-5 bg-[#111C19] border border-[#1F2D29] rounded-[32px] p-8 shadow-xl shadow-black/20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-1.5 h-6 bg-[#22C55E] rounded-full"></div>
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Resumen Operativo</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Estado', val: 'Operativo ✓', color: 'text-[#22C55E]' },
                            { label: 'Sincronización', val: 'Hace 5min', color: 'text-white' },
                            { label: 'Canales', val: '3 Activos', color: 'text-white' },
                            { label: 'Rotación', val: '3.2x Mensual', color: 'text-white' }
                        ].map((item, idx) => (
                            <div key={idx} className="bg-[#0B1412] border border-[#1F2D29] rounded-2xl p-5 hover:bg-[#111C19] transition-all cursor-default">
                                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1.5">{item.label}</p>
                                <p className={`text-sm font-black tracking-tight ${item.color}`}>{item.val}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Donut Chart Card */}
                <div className="lg:col-span-7 bg-[#111C19] border border-[#1F2D29] rounded-[32px] p-8 shadow-xl shadow-black/20 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                    <div className="relative w-40 h-40 rounded-full flex items-center justify-center shrink-0 z-10" style={{ background: 'conic-gradient(#22C55E 0% 65%, #8B7AF0 65% 90%, #6B7280 90% 100%)' }}>
                        <div className="absolute inset-0 m-6 bg-[#111C19] rounded-full flex flex-col items-center justify-center shadow-inner font-black">
                            <span className="text-2xl text-white">100</span>
                            <span className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">Total</span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-5 z-10">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Tráfico por Canal</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { name: 'Web Store', perc: '65', color: 'bg-[#22C55E]' },
                                { name: 'WhatsApp', perc: '25', color: 'bg-[#8B7AF0]' },
                                { name: 'Showroom', perc: '10', color: 'bg-gray-500' }
                            ].map((c, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${c.color} shadow-[0_0_8px_rgba(255,255,255,0.1)]`}></span>
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{c.name}</span>
                                    </div>
                                    <span className="text-xl font-black text-white">{c.perc}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* decorative blur */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#22C55E]/5 rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* ═══════════ ROW 3: FULL SCREEN TABLE ═══════════ */}
            <div className="w-full min-h-[500px]">
                <OperationTable
                    title="Resumen de Inventario Crítico"
                    columns={columns}
                    data={[]}
                    isLoading={loading}
                    totalEntries={0}
                    accentColor="#8B7AF0"
                    emptyMessage="No hay stock crítico detectado"
                    renderRow={(item) => {
                        const isLow = item.stock_total <= item.stock_minimo;
                        return (
                            <tr key={item.sku} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                                <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                    <span className="font-mono text-[11px] font-black text-[#22C55E] tracking-widest uppercase">{item.sku}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-white group-hover:text-[#22C55E] transition-colors tracking-tight">{item.nombre}</span>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Almacén Central</span>
                                    </div>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                    <span className="text-sm font-bold text-gray-400">{item.stock_web}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                    <span className="text-sm font-bold text-gray-400">{item.stock_wsp}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                    <span className="text-base font-black text-white">{item.stock_total}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase shadow-lg shadow-black/30 ${isLow ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'}`}>
                                        {isLow ? 'Bajo Stock' : 'Normal'}
                                    </span>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>
        </div>
    );
};
