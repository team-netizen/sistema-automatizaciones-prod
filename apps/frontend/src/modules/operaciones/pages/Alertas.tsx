import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { operacionesService } from '../services/operacionesService';

export const Alertas = () => {
    const [alertas, setAlertas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ criticas: 0, advertencias: 0 });

    useEffect(() => {
        const fetchAlertas = async () => {
            setLoading(true);
            try {
                const response = await operacionesService.getAlertas();
                const data = response.data || [];
                setAlertas(data);

                const newStats = data.reduce((acc: any, curr: any) => {
                    if (curr.nivel === 'critica') acc.criticas++;
                    if (curr.nivel === 'advertencia') acc.advertencias++;
                    return acc;
                }, { criticas: 0, advertencias: 0 });
                setStats(newStats);
            } catch (error) {
                console.error('Error al cargar alertas:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAlertas();
    }, []);

    const columns = [
        { key: 'prioridad', label: 'Prioridad', align: 'left' as const, sortable: true },
        { key: 'mensaje', label: 'Mensaje de Alerta', align: 'left' as const, sortable: true },
        { key: 'tipo', label: 'Categoría', align: 'center' as const, sortable: true },
        { key: 'fecha', label: 'Tiempo Transc.', align: 'center' as const, sortable: true },
        { key: 'accion', label: 'Acción Sugerida', align: 'right' as const },
        { key: 'gestionar', label: 'Gestionar', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            {/* ── Metric Row ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Alertas Críticas"
                    value={stats.criticas.toString()}
                    iconBgClass="bg-red-500/10"
                    icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                />
                <MetricCard
                    title="Advertencias"
                    value={stats.advertencias.toString()}
                    iconBgClass="bg-orange-500/10"
                    icon={<svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <div className="bg-[#111C19] border border-[#1F2D29] rounded-3xl p-8 flex items-center justify-between shadow-xl shadow-black/20 overflow-hidden relative group cursor-default">
                    <div className="z-10">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2">Salud del Stock</p>
                        <div className="flex items-center gap-4">
                            <span className="text-3xl font-black text-white tracking-tight">92%</span>
                            <div className="flex-1 h-2 w-32 bg-[#0B1412] rounded-full overflow-hidden border border-[#1F2D29] shadow-inner">
                                <div className="h-full bg-[#22C55E] w-[92%] shadow-[0_0_12px_rgba(34,197,94,0.3)] transition-all duration-1000"></div>
                            </div>
                        </div>
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">Estado: Optimizando</p>
                    </div>
                    {/* decorative blur */}
                    <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-[#22C55E]/5 rounded-full blur-3xl group-hover:bg-[#22C55E]/10 transition-all"></div>
                </div>
            </div>

            {/* ── High Density Alerts Table ────────────────── */}
            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Centro de Notificaciones & Alertas"
                    columns={columns}
                    data={alertas}
                    isLoading={loading}
                    totalEntries={alertas.length}
                    accentColor="#ef4444"
                    renderRow={(item) => (
                        <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-lg shadow-black/40 ${item.nivel === 'critica' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                    item.nivel === 'advertencia' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                                    }`}>
                                    {item.nivel || 'INFORMATIVA'}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white group-hover:text-red-400 transition-colors tracking-tight">{item.mensaje}</span>
                                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Afecta: {item.alertas_configuracion?.tipo_alerta || 'Sistema'}</span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-[#0B1412] px-3 py-1.5 rounded-full border border-[#1F2D29]">{item.alertas_configuracion?.tipo_alerta || 'GENERAL'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className="text-xs font-bold text-gray-400 tracking-tight">{item.fecha_generada ? new Date(item.fecha_generada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className="text-[10px] font-black text-white uppercase tracking-widest py-1 border-b border-[#1F2D29] group-hover:border-[#22C55E] transition-all">Gestionar</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <div className="flex justify-end gap-2 text-[#22C55E] opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all">
                                    <button className="h-9 px-5 bg-[#22C55E] text-[#0B1412] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#16A34A] shadow-xl shadow-[#22C55E]/20">
                                        Resolver
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>
        </div>
    );
};
