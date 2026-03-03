import { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { NuevoPedidoModal } from '../components/NuevoPedidoModal';
import { API_URL, authFetch } from '../../../lib/api';

export const Pedidos = () => {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPedido, setSelectedPedido] = useState<any | null>(null);

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const response = await authFetch(`${API_URL}/operaciones/pedidos`);
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

    const formatDate = (value: any) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString();
    };

    const filteredPedidos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return pedidos;

        return pedidos.filter((item) => {
            const haystack = [
                item?.id_transaccion,
                item?.id_orden,
                item?.nombre_cliente,
                item?.dni,
                item?.telefono,
                item?.email,
                item?.direccion_envio,
                item?.distrito,
                item?.provincia,
                item?.metodo_pago,
                item?.productos,
                item?.sku,
                item?.observaciones,
            ]
                .map((v) => String(v ?? '').toLowerCase())
                .join(' ');

            return haystack.includes(term);
        });
    }, [pedidos, searchTerm]);

    const totalVentas = useMemo(
        () => pedidos.reduce((acc, p) => acc + Number(p.monto_total || 0), 0),
        [pedidos]
    );

    const columns = [
        { key: 'id_transaccion', label: 'Order ID', align: 'left' as const, sortable: true },
        { key: 'nombre_cliente', label: 'Cliente', align: 'left' as const, sortable: true },
        { key: 'contacto', label: 'Contacto', align: 'left' as const },
        { key: 'monto_total', label: 'Total', align: 'right' as const, sortable: true },
        { key: 'fecha_pedido', label: 'Fecha Pedido', align: 'center' as const, sortable: true },
        { key: 'estado', label: 'Estado', align: 'right' as const, sortable: true },
        { key: 'acciones', label: 'Detalle', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Pedidos"
                    value={pedidos.length.toString()}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 8h14l-1 11H6L5 8zm2-3h10" /></svg>}
                />
                <MetricCard
                    title="Ventas Totales"
                    value={`$${totalVentas.toFixed(2)}`}
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>}
                />
                <MetricCard
                    title="Confirmados"
                    value={pedidos.filter((p) => p.estado === 'confirmado').length.toString()}
                    iconBgClass="bg-blue-500/10"
                    icon={<svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0" /></svg>}
                />
                <MetricCard
                    title="Pendientes"
                    value={pedidos.filter((p) => p.estado === 'pendiente').length.toString()}
                    iconBgClass="bg-orange-500/10"
                    icon={<svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4">
                <div className="flex-1 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-[10px] flex items-center pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por cliente, DNI, email, sku, order id..."
                            className="w-full bg-[#111C19] border border-[#1F2D29] rounded-2xl text-xs font-bold text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#22C55E]/50 transition-all tracking-wider"
                            style={{ padding: '5px 5px 5px 22px', borderLeftWidth: '5px' }}
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowNewOrderModal(true)}
                        className="h-14 px-10 bg-[#22C55E] text-[#0B1412] text-xs font-black rounded-2xl hover:bg-[#16A34A] transition-all shadow-xl shadow-[#22C55E]/20 flex items-center gap-3 uppercase tracking-widest"
                    >
                        <span className="text-xl">+</span> Nuevo Pedido
                    </button>
                </div>
            </div>

            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Control Maestro de Pedidos"
                    columns={columns}
                    data={filteredPedidos}
                    isLoading={loading}
                    totalEntries={filteredPedidos.length}
                    accentColor="#8B7AF0"
                    renderRow={(item) => {
                        const estado = String(item?.estado || '').toLowerCase();
                        return (
                            <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all">
                                <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-[10px] font-black text-[#22C55E] tracking-widest uppercase bg-[#22C55E]/5 px-2 py-1 rounded-md w-fit mb-1">
                                            {item.id_transaccion || 'SIN ID'}
                                        </span>
                                        <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">
                                            ORDEN EXT: {item.id_orden || 'N/A'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-200">{item.nombre_cliente || 'Sin nombre'}</span>
                                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">DNI: {item.dni || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-300">{item.telefono || '-'}</span>
                                        <span className="text-[10px] text-gray-500 truncate max-w-[220px]">{item.email || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                    <span className="font-black text-white text-base">${Number(item.monto_total || 0).toFixed(2)}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                    <span className="text-xs font-bold text-gray-300">{formatDate(item.fecha_pedido || item.fecha_sinc)}</span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/30 border ${estado === 'confirmado'
                                        ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                                        : estado === 'pendiente'
                                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                        }`}>
                                        {item.estado || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                    <button
                                        onClick={() => setSelectedPedido(item)}
                                        className="h-9 px-4 bg-[#1F2D29] rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-white hover:bg-[#22C55E]/20 transition-all"
                                    >
                                        Ver
                                    </button>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            {selectedPedido && (
                <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPedido(null)}>
                    <div className="w-full max-w-4xl bg-[#0F1412] border border-[#1F2D29] rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="px-8 py-6 border-b border-[#1F2D29] flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-gray-300">Detalle Completo del Pedido</h3>
                            <button onClick={() => setSelectedPedido(null)} className="text-gray-500 hover:text-white transition-colors">Cerrar</button>
                        </div>

                        <div className="pedido-detail-scroll p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                            <Field label="ORDER ID" value={selectedPedido.id_transaccion} />
                            <Field label="ID ORDEN EXTERNA" value={selectedPedido.id_orden} />
                            <Field label="DNI" value={selectedPedido.dni} />
                            <Field label="FECHA PEDIDO" value={formatDate(selectedPedido.fecha_pedido || selectedPedido.fecha_sinc)} />
                            <Field label="ESTADO" value={selectedPedido.estado} />
                            <Field label="NOMBRE CLIENTE" value={selectedPedido.nombre_cliente} />
                            <Field label="TELEFONO" value={selectedPedido.telefono} />
                            <Field label="EMAIL" value={selectedPedido.email} />
                            <Field label="DIRECCION ENVIO" value={selectedPedido.direccion_envio} />
                            <Field label="DISTRITO" value={selectedPedido.distrito} />
                            <Field label="PROVINCIA" value={selectedPedido.provincia} />
                            <Field label="TOTAL" value={`$${Number(selectedPedido.monto_total || 0).toFixed(2)}`} />
                            <Field label="METODO PAGO" value={selectedPedido.metodo_pago} />
                            <Field label="PRODUCTOS" value={selectedPedido.productos} fullWidth />
                            <Field label="CANTIDAD" value={selectedPedido.cantidad} fullWidth />
                            <Field label="SKU" value={selectedPedido.sku} fullWidth />
                            <Field label="OBSERVACIONES" value={selectedPedido.observaciones} fullWidth />
                        </div>
                    </div>
                </div>
            )}

            <NuevoPedidoModal
                isOpen={showNewOrderModal}
                onClose={() => setShowNewOrderModal(false)}
                onSuccess={fetchPedidos}
            />
        </div>
    );
};

const Field = ({ label, value, fullWidth = false }: { label: string; value: any; fullWidth?: boolean }) => (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] mb-2">{label}</p>
        <div className="bg-[#111C19] border border-[#1F2D29] rounded-xl px-4 py-3 text-sm text-gray-200 break-words">
            {String(value ?? '').trim() || 'No enviado por WooCommerce'}
        </div>
    </div>
);
