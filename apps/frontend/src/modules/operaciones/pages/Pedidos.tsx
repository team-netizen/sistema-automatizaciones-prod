import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { NuevoPedidoModal } from '../components/NuevoPedidoModal';
import { API_URL, getAuthHeaders } from '../../../lib/api';

export const Pedidos = () => {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pedidos`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Error al obtener pedidos');

            const data = await response.json();
            setPedidos(data.data || []);
        } catch (error) {
            console.error('Error fetching pedidos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
    }, []);

    const columns = [
        { key: 'id_transaccion', label: 'ID Transacción', align: 'left' as const, sortable: true },
        { key: 'canal_origen', label: 'Canal Origen', align: 'center' as const, sortable: true },
        { key: 'monto_total', label: 'Monto Total', align: 'right' as const, sortable: true },
        { key: 'fecha_sinc', label: 'Fecha Sinc.', align: 'center' as const, sortable: true },
        { key: 'estado', label: 'Estado', align: 'right' as const },
        { key: 'acciones', label: 'Acción', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            {/* ── Metric Row ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Ventas Hoy"
                    value="$1,240"
                    trend={{ value: 12, isPositive: true }}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <MetricCard
                    title="Pedidos Nuevos"
                    value="18"
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                />
                <MetricCard
                    title="Pagos Pendientes"
                    value="5"
                    iconBgClass="bg-orange-500/10"
                    icon={<svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                />
                <MetricCard
                    title="Sincronizaciones"
                    value="99.9%"
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
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
                            placeholder="Buscar pedidos por ID, cliente o canal..."
                            className="w-full bg-[#111C19] border border-[#1F2D29] rounded-2xl text-xs font-bold text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#22C55E]/50 transition-all tracking-wider"
                            style={{ padding: '5px 5px 5px 22px', borderLeftWidth: '5px' }}
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="h-14 px-8 bg-[#111C19] border border-[#1F2D29] text-xs font-black uppercase tracking-widest text-cyan-400 rounded-2xl hover:bg-[#1F2D29] transition-all flex items-center gap-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Sync Canales
                    </button>
                    <button
                        onClick={() => setShowNewOrderModal(true)}
                        className="h-14 px-10 bg-[#22C55E] text-[#0B1412] text-xs font-black rounded-2xl hover:bg-[#16A34A] transition-all shadow-xl shadow-[#22C55E]/20 flex items-center gap-3 uppercase tracking-widest"
                    >
                        <span className="text-xl">+</span> Nuevo Pedido
                    </button>
                </div>
            </div>

            {/* ── High Density Pedidos Table ───────────────── */}
            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Control Maestro de Pedidos"
                    columns={columns}
                    data={pedidos}
                    isLoading={loading}
                    totalEntries={pedidos.length}
                    accentColor="#8B7AF0"
                    renderRow={(item) => {
                        const canalOrigen = String(item.canal_origen ?? '').toLowerCase();

                        return (
                        <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="font-mono text-[10px] font-black text-[#22C55E] tracking-widest uppercase bg-[#22C55E]/5 px-2 py-1 rounded-md w-fit mb-1">
                                        {item.id_transaccion || 'SIN ID'}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">
                                        ORDEN: {item.id_orden || 'N/A'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${canalOrigen.includes('web') ? 'bg-[#8B7AF0]/10 text-[#8B7AF0] border border-[#8B7AF0]/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                                    {item.canal_origen || 'DESCONOCIDO'}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className="font-black text-white text-base">
                                    ${Number(item.monto_total).toFixed(2)}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-300 tracking-tight">
                                        {new Date(item.fecha_sinc).toLocaleDateString()}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                                        A las {new Date(item.fecha_sinc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/30 border ${item.estado === 'procesado' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' :
                                    item.estado === 'pendiente' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        item.estado === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                    }`}>
                                    {item.estado}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <button className="w-10 h-10 bg-[#1F2D29] rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#22C55E]/20 transition-all opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </button>
                            </td>
                        </tr>
                        );
                    }}
                />
            </div>

            <NuevoPedidoModal
                isOpen={showNewOrderModal}
                onClose={() => setShowNewOrderModal(false)}
                onSuccess={fetchPedidos}
            />
        </div>
    );
};
