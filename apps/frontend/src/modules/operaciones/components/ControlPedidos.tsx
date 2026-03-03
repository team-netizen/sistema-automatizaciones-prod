import { useEffect, useState } from 'react';
import obtenerPedidos from '../../../services/obtenerPedidos';
import { OperationTable } from './OperationTable';

const ControlPedidos = () => {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Ejecutamos la función para cargar los pedidos al cargar el componente
    useEffect(() => {
        const fetchPedidos = async () => {
            setLoading(true);
            const data = await obtenerPedidos(); // Llamada al servicio de frontend
            setPedidos(data);
            setLoading(false);
        };

        fetchPedidos();
    }, []);

    const columns = [
        { key: 'id_transaccion', label: 'ID Transacción', align: 'left' as const },
        { key: 'canal_origen', label: 'Canal Origen', align: 'center' as const },
        { key: 'monto_total', label: 'Monto Total', align: 'right' as const },
        { key: 'fecha_sinc', label: 'Fecha Sincronización', align: 'center' as const },
        { key: 'estado', label: 'Estado', align: 'right' as const },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Control Maestro de Pedidos</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Sincronización en tiempo real de canales digitales</p>
                </div>
            </div>

            <OperationTable
                title="Monitoreo de Órdenes"
                columns={columns}
                data={pedidos}
                isLoading={loading}
                accentColor="#22C55E"
                totalEntries={pedidos.length}
                renderRow={(pedido) => (
                    <tr key={pedido.id_transaccion} className="group hover:bg-[#111C19]/60 transition-all cursor-pointer">
                        <td className="px-8 py-5">
                            <span className="font-mono text-[10px] font-black text-[#22C55E] tracking-widest uppercase bg-[#22C55E]/5 px-2 py-1 rounded-md">
                                {pedido.id_transaccion}
                            </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${pedido.canal_origen.toLowerCase().includes('web')
                                ? 'bg-[#8B7AF0]/10 text-[#8B7AF0] border border-[#8B7AF0]/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                }`}>
                                {pedido.canal_origen}
                            </span>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-white text-base">
                            ${Number(pedido.monto_total).toFixed(2)}
                        </td>
                        <td className="px-8 py-5 text-center">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-300">
                                    {new Date(pedido.fecha_sinc).toLocaleDateString()}
                                </span>
                                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                                    {new Date(pedido.fecha_sinc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${pedido.estado === 'procesado' || pedido.estado === 'completado'
                                ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                }`}>
                                {pedido.estado}
                            </span>
                        </td>
                    </tr>
                )}
            />
        </div>
    );
};

export default ControlPedidos;
