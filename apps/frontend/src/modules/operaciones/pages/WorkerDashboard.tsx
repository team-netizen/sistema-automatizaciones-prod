import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { operacionesService } from '../services/operacionesService';

export const WorkerDashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [myRecentMovements, setMyRecentMovements] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Métricas generales (reutilizamos el endpoint de dashboard)
                const dashboardRes = await operacionesService.getDashboardMetrics();
                setStats(dashboardRes);

                // Movimientos recientes (filtrar por el usuario actual sería ideal en el backend, 
                // por ahora traemos los generales o simulamos el 'personal' context)
                const movementsRes = await operacionesService.getMovimientos({ limit: 5 });
                setMyRecentMovements(movementsRes.data || []);
            } catch (error) {
                console.error('Error fetching worker dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const columns = [
        { key: 'tipo', label: 'Operación', align: 'left' as const },
        { key: 'producto', label: 'Producto', align: 'left' as const },
        { key: 'cantidad', label: 'Cant.', align: 'center' as const },
        { key: 'fecha', label: 'Fecha / Hora', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            {/* ── Visual Header for Workers ──────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#111C19] border border-[#1F2D29] rounded-[32px] p-8 shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center border border-[#22C55E]/20">
                        <svg className="w-8 h-8 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Mi Turno Operativo</h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 opacity-70">Control de flujo de inventario y tareas diarias</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="h-12 px-8 bg-[#22C55E] text-[#0B1412] text-[10px] font-black rounded-2xl hover:scale-105 transition-all shadow-lg shadow-[#22C55E]/20 uppercase tracking-widest">+ Registrar Entrada</button>
                    <button className="h-12 px-8 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black rounded-2xl hover:bg-red-500/20 transition-all uppercase tracking-widest">- Registrar Salida</button>
                </div>
            </div>

            {/* ── Operational Metrics ────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    isLoading={loading}
                    title="Mis Movimientos (Hoy)"
                    value={myRecentMovements.length || '0'}
                    iconBgClass="bg-blue-500/10"
                    icon={<svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <MetricCard
                    isLoading={loading}
                    title="Stock Bajo Crítico"
                    value={stats?.metricas?.total_productos ? '3' : '0'} // Mocked placeholder since it's worker-urgent
                    iconBgClass="bg-red-500/10"
                    icon={<svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                />
                <MetricCard
                    isLoading={loading}
                    title="Alertas Globales"
                    value={stats?.metricas?.alertas_activas || '0'}
                    iconBgClass="bg-orange-500/10"
                    icon={<svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                />
            </div>

            {/* ── My Recent Activity Table ───────────────── */}
            <div className="w-full min-h-[400px]">
                <OperationTable
                    title="Mi Actividad Reciente"
                    columns={columns}
                    data={myRecentMovements}
                    isLoading={loading}
                    totalEntries={myRecentMovements.length}
                    accentColor="#22C55E"
                    renderRow={(item) => (
                        <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.tipo === 'ENTRADA' ? 'bg-[#22C55E]/10 text-[#22C55E]' : item.tipo === 'SALIDA' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {item.tipo}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white group-hover:text-[#22C55E] transition-colors">{item.productos?.nombre || 'Producto Desconocido'}</span>
                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Almacén Central</span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className="text-base font-black text-white">{item.cantidad}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30 text-gray-500 font-bold text-xs">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                        </tr>
                    )}
                />
            </div>
        </div>
    );
};
