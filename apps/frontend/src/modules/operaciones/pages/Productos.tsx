import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { API_URL, authFetch } from '../../../lib/api';

export const Productos = () => {
    const [productos, setProductos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const [selectedProducto, setSelectedProducto] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formNombre, setFormNombre] = useState('');
    const [formSku, setFormSku] = useState('');
    const [formDescripcion, setFormDescripcion] = useState('');
    const [formPrecio, setFormPrecio] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const limpiarFormulario = () => {
        setFormNombre('');
        setFormSku('');
        setFormDescripcion('');
        setFormPrecio('');
        setSelectedProducto(null);
        setIsEditing(false);
    };

    const abrirModalCrear = () => {
        limpiarFormulario();
        setShowModal(true);
    };

    const abrirModalEditar = (producto: any) => {
        setSelectedProducto(producto);
        setFormNombre(producto.nombre || '');
        setFormSku(producto.sku || '');
        setFormDescripcion(producto.descripcion || '');
        setFormPrecio(producto.precio?.toString() || '');
        setIsEditing(true);
        setShowModal(true);
    };

    const cargarProductos = async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_URL}/productos`);
            if (!res.ok) throw new Error("Error API");
            const data = await res.json();
            setProductos(data.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarProductos();
    }, []);

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const url = isEditing ? `${API_URL}/productos/${selectedProducto.id}` : `${API_URL}/productos`;
            const method = isEditing ? "PUT" : "POST";

            const response = await authFetch(url, {
                method: method,
                body: JSON.stringify({
                    nombre: formNombre,
                    sku: formSku,
                    descripcion: formDescripcion,
                    precio: parseFloat(formPrecio) || 0,
                    activo: isEditing ? selectedProducto.activo : true
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showToast(isEditing ? "Producto actualizado correctamente" : "Producto creado correctamente");
                setShowModal(false);
                limpiarFormulario();
                await cargarProductos();
            } else {
                showToast(result.error || "Error al procesar producto", "error");
            }
        } catch (error) {
            console.error("Fallo crítico:", error);
            showToast("Error fatal de red", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEliminar = async (id: string) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar este producto?")) return;

        try {
            const response = await authFetch(`${API_URL}/productos/${id}`, {
                method: "DELETE",
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showToast("Producto eliminado correctamente");
                await cargarProductos();
            } else {
                showToast(result.error || "Error al eliminar producto", "error");
            }
        } catch (error) {
            console.error("Error al eliminar:", error);
            showToast("Error al conectar con la API", "error");
        }
    };

    const filtrados = productos.filter(item => {
        const busquedaLower = busqueda.toLowerCase();
        return (
            (item.nombre?.toLowerCase() || '').includes(busquedaLower) ||
            (item.sku?.toLowerCase() || '').includes(busquedaLower)
        );
    });

    const columns = [
        { key: 'sku', label: 'SKU / ID', align: 'left' as const, sortable: true },
        { key: 'nombre', label: 'Nombre del Producto', align: 'left' as const, sortable: true },
        { key: 'descripcion', label: 'Descripción', align: 'left' as const },
        { key: 'precio', label: 'Precio', align: 'right' as const, sortable: true },
        { key: 'activo', label: 'Estado', align: 'right' as const },
        { key: 'acciones', label: 'Acciones', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full relative">
            {/* ── Metric Row ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Productos"
                    value={productos.length.toString()}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                />
                <MetricCard
                    title="Valor Inventario Est."
                    value={`$${productos.reduce((acc, p) => acc + (p.precio || 0), 0).toLocaleString()}`}
                    trend={{ value: 0, isPositive: true }}
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <MetricCard
                    title="Activos"
                    value={productos.filter(p => p.activo).length.toString()}
                    iconBgClass="bg-blue-500/10"
                    icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <MetricCard
                    title="Categorías"
                    value="1"
                    iconBgClass="bg-[#8B7AF0]/10"
                    icon={<svg className="w-5 h-5 text-[#8B7AF0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 11h.01M7 15h.01M11 7h.01M11 11h.01M11 15h.01M15 7h.01M15 11h.01M15 15h.01M19 7h.01M19 11h.01M19 15h.01M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" /></svg>}
                />
            </div>

            {/* ── Search & Actions bar ─────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4">
                <div className="flex-1 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-[10px] flex items-center pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar productos por SKU o nombre..."
                            className="w-full bg-[#111C19] border border-[#1F2D29] rounded-2xl text-xs font-bold text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#22C55E]/50 focus:ring-1 focus:ring-[#22C55E]/20 transition-all tracking-wider"
                            style={{ padding: '5px 5px 5px 22px', borderLeftWidth: '5px' }}
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={abrirModalCrear}
                        className="h-14 px-10 bg-[#22C55E] text-[#0B1412] text-xs font-black rounded-2xl hover:bg-[#16A34A] transition-all shadow-xl shadow-[#22C55E]/20 flex items-center gap-3 uppercase tracking-widest"
                    >
                        <span className="text-xl">+</span> Agregar Producto
                    </button>
                </div>
            </div>

            {/* ── High Density Table ───────────────────────── */}
            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Listado Maestro de Inventario"
                    columns={columns}
                    data={filtrados}
                    isLoading={loading}
                    loadingMessage="Cargando catálogo de productos..."
                    emptyMessage="No hay productos registrados"
                    totalEntries={productos.length}
                    renderRow={(producto) => (
                        <tr key={producto.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className="font-mono text-[10px] font-black text-[#22C55E] tracking-widest uppercase bg-[#22C55E]/5 px-2 py-1 rounded-md">{producto.sku || 'S/SKU'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className="text-sm font-black text-white group-hover:text-[#22C55E] transition-colors tracking-tight">{producto.nombre}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <span className="text-[11px] font-medium text-gray-400 line-clamp-1 max-w-[250px]">{producto.descripcion || '—'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className="font-black text-white text-base">${Number(producto.precio).toFixed(2)}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase ${producto.activo ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-red-500/10 text-red-500'}`}>
                                    {producto.activo ? "Activo" : "Inactivo"}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => abrirModalEditar(producto)}
                                        className="w-9 h-9 bg-[#1F2D29] rounded-xl flex items-center justify-center text-gray-400 hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all"
                                        title="Editar"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleEliminar(producto.id)}
                                        className="w-9 h-9 bg-[#1F2D29] rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        title="Eliminar"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            {/* ── Modal (Add Product) ────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0A0C0B]/90 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="bg-[#0F1412] border border-white/5 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-8 pt-8 pb-6 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-1.5 h-4 bg-[#22C55E] rounded-full"></span>
                                    <p className="text-[10px] font-bold tracking-widest text-[#22C55E] uppercase">Catálogo de inventario</p>
                                </div>
                                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                                    {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
                                </h1>
                            </div>
                            <button
                                onClick={() => { setShowModal(false); limpiarFormulario(); }}
                                className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 mt-1"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleGuardar} className="px-8 pb-8 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Nombre</label>
                                    <input
                                        required
                                        type="text"
                                        value={formNombre}
                                        onChange={(e) => setFormNombre(e.target.value)}
                                        placeholder="Ej: Teclado RGB"
                                        className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">SKU</label>
                                    <input
                                        type="text"
                                        value={formSku}
                                        onChange={(e) => setFormSku(e.target.value)}
                                        placeholder="TK-2024-X"
                                        className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Descripción</label>
                                <textarea
                                    value={formDescripcion}
                                    onChange={(e) => setFormDescripcion(e.target.value)}
                                    placeholder="Detalles del producto..."
                                    className="w-full px-5 py-4 bg-[#161B19] border-0 rounded-2xl text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] resize-none transition-all duration-200 focus:outline-none min-h-[120px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Precio de Venta</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formPrecio}
                                        onChange={(e) => setFormPrecio(e.target.value)}
                                        className="w-full pl-12 pr-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); limpiarFormulario(); }}
                                    className="w-full sm:flex-1 py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase text-gray-400 hover:bg-white/5 transition-colors"
                                >Cancelar</button>
                                <button
                                    disabled={isSaving}
                                    type="submit"
                                    className="w-full sm:flex-[2] py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase bg-[#22C55E] text-[#0A0C0B] hover:opacity-90 transition-all transform active:scale-[0.98] shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none"
                                >
                                    {isSaving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Producto')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Toast Notification ────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-10 right-10 z-[100] px-8 py-5 rounded-[24px] shadow-2xl animate-slideInRight flex items-center gap-4 ${toast.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-500' : 'bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]'
                    }`}>
                    <div className={`w-2 h-2 rounded-full animate-ping ${toast.type === 'error' ? 'bg-red-500' : 'bg-[#22C55E]'}`}></div>
                    <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
                </div>
            )}
        </div>
    );
};
