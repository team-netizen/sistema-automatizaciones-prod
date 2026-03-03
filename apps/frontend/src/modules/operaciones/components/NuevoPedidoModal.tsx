import React, { useState, useEffect } from 'react';
import { API_URL, getAuthHeaders } from '../../../lib/api';

interface Producto {
    id: string;
    nombre: string;
    sku: string;
    precio: number;
}

interface Sucursal {
    id: string;
    nombre: string;
    activa: boolean;
}

interface ItemPedido {
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    sku_producto: string;
}

interface NuevoPedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const NuevoPedidoModal: React.FC<NuevoPedidoModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);

    // Form State
    const [sucursalId, setSucursalId] = useState('');
    const [medio, setMedio] = useState<'web' | 'wsp' | 'fisico'>('fisico');
    const [clienteNombre, setClienteNombre] = useState('');
    const [dniCliente, setDniCliente] = useState('');
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [items, setItems] = useState<ItemPedido[]>([]);

    // UI State
    const [productoSeleccionado, setProductoSeleccionado] = useState('');
    const [cantidadSeleccionada, setCantidadSeleccionada] = useState(1);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        try {
            const [resSucursales, resProductos] = await Promise.all([
                fetch(`${API_URL}/sucursales`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/productos`, { headers: getAuthHeaders() })
            ]);

            const dataSuc = await resSucursales.json();
            const dataProd = await resProductos.json();

            setSucursales(dataSuc.data?.filter((s: any) => s.activa) || []);
            setProductos(dataProd.data || []);
        } catch (err) {
            console.error('Error fetching modal data:', err);
        }
    };

    const addItem = () => {
        const prod = productos.find(p => p.id === productoSeleccionado);
        if (!prod) return;

        const existing = items.find(i => i.producto_id === prod.id);
        if (existing) {
            setItems(items.map(i => i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + cantidadSeleccionada } : i));
        } else {
            setItems([...items, {
                producto_id: prod.id,
                nombre: prod.nombre,
                cantidad: cantidadSeleccionada,
                precio_unitario: prod.precio,
                sku_producto: prod.sku
            }]);
        }
        setProductoSeleccionado('');
        setCantidadSeleccionada(1);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.producto_id !== id));
    };

    const total = items.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sucursalId || items.length === 0) {
            setError('Faltan campos obligatorios');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    medio_pedido: medio,
                    cliente_nombre: clienteNombre,
                    dni_cliente: dniCliente,
                    metodo_pago: metodoPago,
                    total: total,
                    items: items
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al crear pedido');
            }

            onSuccess();
            onClose();
            // Reset form
            setItems([]);
            setClienteNombre('');
            setDniCliente('');
            setSucursalId('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0A0C0B]/90 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0F1412] border border-white/5 w-full max-w-4xl rounded-3xl flex overflow-hidden shadow-2xl animate-scaleIn h-[85vh]">

                {/* Sidebar Navigation */}
                <div className="w-64 bg-[#161B19] border-r border-[#1F2D29]/30 p-8 flex flex-col">
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-4 bg-[#22C55E] rounded-full"></span>
                            <p className="text-[10px] font-bold tracking-widest text-[#22C55E] uppercase">Gestión de Pedidos</p>
                        </div>
                        <h2 className="text-white font-extrabold uppercase tracking-[0.2em] text-sm">Nuevo Pedido</h2>
                    </div>

                    <div className="space-y-4 flex-1">
                        <button
                            onClick={() => setStep(1)}
                            className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 ${step === 1 ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-[#22C55E] text-[#0A0C0B]' : 'bg-[#1F2D29]/50'}`}>1</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Información</span>
                        </button>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!sucursalId}
                            className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 ${step === 2 ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' : 'text-gray-400 hover:text-gray-300 opacity-50'}`}
                        >
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-[#22C55E] text-[#0A0C0B]' : 'bg-[#1F2D29]/50'}`}>2</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Productos</span>
                        </button>
                    </div>

                    <div className="mt-auto pt-10 border-t border-[#1F2D29]/30">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Total Estimado</p>
                        <p className="text-3xl font-extrabold text-white tracking-tighter">${total.toFixed(2)}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col relative">
                    <button onClick={onClose} className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 z-10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="flex-1 overflow-y-auto p-12 scrollbar-thin scrollbar-thumb-[#1F2D29]/50">
                        {error && (
                            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-xs font-bold flex items-center gap-3">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {step === 1 ? (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Sucursal de Despacho</label>
                                        <select
                                            value={sucursalId}
                                            onChange={(e) => setSucursalId(e.target.value)}
                                            className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none appearance-none"
                                        >
                                            <option value="">Seleccionar Sucursal...</option>
                                            {sucursales.map(s => (
                                                <option key={s.id} value={s.id}>{s.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Medio de Pedido</label>
                                        <div className="flex bg-[#161B19] rounded-2xl p-1 h-[58px]">
                                            {(['web', 'wsp', 'fisico'] as const).map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setMedio(m)}
                                                    className={`flex-1 flex items-center justify-center rounded-[10px] text-xs font-bold uppercase tracking-widest transition-all duration-200 ${medio === m ? 'bg-[#22C55E] text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-gray-400 hover:text-gray-300'}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Nombre Cliente</label>
                                        <input
                                            type="text"
                                            value={clienteNombre}
                                            onChange={(e) => setClienteNombre(e.target.value)}
                                            placeholder="Juan Perez"
                                            className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">DNI / RUC</label>
                                        <input
                                            type="text"
                                            value={dniCliente}
                                            onChange={(e) => setDniCliente(e.target.value)}
                                            placeholder="70000000"
                                            className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Método de Pago</label>
                                    <select
                                        value={metodoPago}
                                        onChange={(e) => setMetodoPago(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none appearance-none"
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="tarjeta">Tarjeta (POS)</option>
                                        <option value="yape_plin">Yape / Plin</option>
                                    </select>
                                </div>

                                <div className="pt-8">
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!sucursalId}
                                        className="w-full py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase bg-[#22C55E] text-[#0A0C0B] hover:opacity-90 transition-all transform active:scale-[0.98] shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                                    >
                                        Siguiente: Productos <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="bg-[#0F1412] border border-white/5 rounded-3xl p-8 space-y-6">
                                    <div className="grid grid-cols-12 gap-4">
                                        <div className="col-span-12 sm:col-span-7 space-y-2">
                                            <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Producto</label>
                                            <select
                                                value={productoSeleccionado}
                                                onChange={(e) => setProductoSeleccionado(e.target.value)}
                                                className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none appearance-none"
                                            >
                                                <option value="">Buscar Producto...</option>
                                                {productos.map(p => (
                                                    <option key={p.id} value={p.id}>{p.nombre} (${p.precio})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-6 sm:col-span-3 space-y-2">
                                            <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase ml-1">Cant.</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={cantidadSeleccionada}
                                                onChange={(e) => setCantidadSeleccionada(parseInt(e.target.value))}
                                                className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                            />
                                        </div>
                                        <div className="col-span-6 sm:col-span-2 flex items-end">
                                            <button
                                                onClick={addItem}
                                                disabled={!productoSeleccionado}
                                                className="w-full h-[56px] py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase bg-[#22C55E] text-[#0A0C0B] hover:opacity-90 transition-all transform active:scale-[0.98] shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none"
                                            >
                                                ADD
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest pl-1 mb-2">Items en Carrito</div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {items.length === 0 ? (
                                                <div className="text-center py-10 text-gray-600 text-[10px] font-black uppercase tracking-widest border border-dashed border-[#1F2D29] rounded-2xl">
                                                    No hay productos agregados
                                                </div>
                                            ) : (
                                                items.map((item) => (
                                                    <div key={item.producto_id} className="bg-[#0B1412] border border-[#1F2D29] p-4 rounded-2xl flex items-center justify-between group">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white">{item.nombre}</span>
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">SKU: {item.sku_producto} | ${item.precio_unitario} x {item.cantidad}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-black text-[#22C55E] tracking-tight">${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
                                                            <button
                                                                onClick={() => removeItem(item.producto_id)}
                                                                className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="w-full sm:flex-1 py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase text-gray-400 hover:bg-white/5 transition-colors"
                                    >
                                        Regresar
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || items.length === 0}
                                        className="w-full sm:flex-[2] py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase bg-[#22C55E] text-[#0A0C0B] hover:opacity-90 transition-all transform active:scale-[0.98] shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                                    >
                                        {loading ? 'Procesando...' : 'Confirmar Pedido'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
