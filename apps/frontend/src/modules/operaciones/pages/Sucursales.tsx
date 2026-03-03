import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { OperationTable } from '../components/OperationTable';
import { API_URL, authFetch } from '../../../lib/api';

export const Sucursales = () => {
    const [sucursales, setSucursales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Form states
    const [formNombre, setFormNombre] = useState('');
    const [formTipo, setFormTipo] = useState('Física');
    const [formUbicacion, setFormUbicacion] = useState('');
    const [formActiva, setFormActiva] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const cargarSucursales = async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_URL}/sucursales`);
            if (!res.ok) throw new Error("Error cargando sucursales");
            const data = await res.json();
            setSucursales(data.data || []);
        } catch (error) {
            console.error(error);
            showToast("Error al cargar sucursales", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarSucursales();
    }, []);

    const limpiarFormulario = () => {
        setFormNombre('');
        setFormTipo('Física');
        setFormUbicacion('');
        setFormActiva(true);
        setSelectedId(null);
        setIsEditing(false);
    };

    const abrirModalCrear = () => {
        limpiarFormulario();
        setShowModal(true);
    };

    const abrirModalEditar = (item: any) => {
        setSelectedId(item.id);
        setFormNombre(item.nombre || '');
        setFormTipo(item.tipo || 'Física');
        setFormUbicacion(item.direccion || '');
        setFormActiva(item.activa);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `${API_URL}/sucursales/${selectedId}` : `${API_URL}/sucursales`;

            const res = await authFetch(url, {
                method,
                body: JSON.stringify({
                    nombre: formNombre,
                    tipo: formTipo,
                    direccion: formUbicacion,
                    activa: formActiva
                })
            });

            if (!res.ok) throw new Error("Error al guardar");

            showToast(isEditing ? "Sucursal actualizada" : "Sucursal creada");
            setShowModal(false);
            cargarSucursales();
        } catch (error) {
            showToast("Error al procesar la solicitud", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta sucursal?")) return;
        try {
            const res = await authFetch(`${API_URL}/sucursales/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Error al eliminar");
            showToast("Sucursal eliminada");
            cargarSucursales();
        } catch (error) {
            showToast("Error al eliminar", "error");
        }
    };

    const filtrados = sucursales.filter(item =>
        item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.tipo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.direccion?.toLowerCase().includes(busqueda.toLowerCase())
    );

    const columns = [
        { key: 'nombre', label: 'Nombre de Sucursal', align: 'left' as const, sortable: true },
        { key: 'tipo', label: 'Tipo / Canal', align: 'center' as const, sortable: true },
        { key: 'direccion', label: 'Ubicación', align: 'left' as const },
        { key: 'total_skus', label: 'SKUs', align: 'center' as const },
        { key: 'total_stock', label: 'Stock Total', align: 'right' as const },
        { key: 'activa', label: 'Estado', align: 'right' as const },
        { key: 'acciones', label: 'Gestión', align: 'right' as const },
    ];

    return (
        <div className="space-y-10 animate-fadeIn w-full relative">
            {/* ── Toast Feedback ────────────────────────── */}
            {toast && (
                <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideInRight ${toast.type === 'success' ? 'bg-[#22C55E] text-[#0B1412]' : 'bg-red-500 text-white'
                    }`}>
                    <span className="font-black uppercase tracking-widest text-[10px]">{toast.message}</span>
                </div>
            )}

            {/* ── Metric Row ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Sucursales Activas"
                    value={sucursales.filter(s => s.activa).length.toString()}
                    iconBgClass="bg-[#22C55E]/10"
                    icon={<svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                />
                <MetricCard
                    title="Total Canales"
                    value={sucursales.length.toString()}
                    iconBgClass="bg-[#8B7AF0]/10"
                    icon={<svg className="w-5 h-5 text-[#8B7AF0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
                />
                <MetricCard
                    title="Inventario Consolidado"
                    value={sucursales.reduce((acc, s) => acc + (s.total_stock || 0), 0).toLocaleString()}
                    iconBgClass="bg-red-500/10"
                    icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />
                <MetricCard
                    title="Promedio SKUs"
                    value={sucursales.length > 0 ? (sucursales.reduce((acc, s) => acc + (s.total_skus || 0), 0) / sucursales.length).toFixed(1) : "0"}
                    iconBgClass="bg-cyan-500/10"
                    icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
            </div>

            {/* ── Search & Filter bar ──────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4">
                <div className="flex-1 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-[22px] flex items-center pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar sucursales, sedes o almacenes..."
                            className="w-full bg-[#111C19] border border-[#1F2D29] rounded-2xl text-[10px] font-bold text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#22C55E]/50 transition-all tracking-wider h-14"
                            style={{ paddingLeft: '50px', borderLeftWidth: '5px' }}
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={abrirModalCrear}
                        className="h-14 px-10 bg-[#22C55E] text-[#0B1412] text-[10px] font-black rounded-2xl hover:bg-[#16A34A] transition-all shadow-xl shadow-[#22C55E]/20 flex items-center gap-3 uppercase tracking-widest"
                    >
                        <span className="text-xl">+</span> Nueva Sucursal
                    </button>
                </div>
            </div>

            {/* ── High Density Sucursales Table ────────────── */}
            <div className="w-full min-h-[600px]">
                <OperationTable
                    title="Maestro de Sedes & Almacenes"
                    columns={columns}
                    data={filtrados}
                    isLoading={loading}
                    totalEntries={sucursales.length}
                    accentColor="#8B7AF0"
                    renderRow={(item) => (
                        <tr key={item.id} className="group hover:bg-[#0B1412]/40 transition-all cursor-pointer">
                            <td className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/30">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white group-hover:text-[#22C55E] transition-colors tracking-tight">{item.nombre}</span>
                                    <span className="font-mono text-[8px] text-[#22C55E]/60 font-black tracking-widest uppercase">ID SUC: #{item.id.slice(0, 8)}</span>
                                </div>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.tipo?.toLowerCase().includes('web') || item.tipo?.toLowerCase().includes('digital') ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-[#1F2D29] text-gray-400'}`}>
                                    {item.tipo}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-left border-b border-[#1F2D29]/30">
                                <span className="text-[10px] font-bold text-gray-400 tracking-tight line-clamp-1 max-w-[200px]">{item.direccion || 'No especificada'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center border-b border-[#1F2D29]/30">
                                <span className="text-sm font-black text-white">{item.total_skus || 0}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className="text-base font-black text-white">{Number(item.total_stock || 0).toLocaleString()}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${item.activa ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {item.activa ? "Activa" : "Inactiva"}
                                </span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-right border-b border-[#1F2D29]/30">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => abrirModalEditar(item)}
                                        className="w-10 h-10 bg-[#1F2D29] rounded-xl flex items-center justify-center text-gray-400 hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all"
                                        title="Editar"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleEliminar(item.id)}
                                        className="w-10 h-10 bg-[#1F2D29] rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        title="Eliminar"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            {/* ── Modal Form ──────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0A0C0B]/90 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0F1412] border border-white/5 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-scaleIn">
                        <div className="px-8 pt-8 pb-6 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-1.5 h-4 bg-[#22C55E] rounded-full"></span>
                                    <p className="text-[10px] font-bold tracking-widest text-[#22C55E] uppercase">Gestión de Punto de Venta / Despacho</p>
                                </div>
                                <h1 className="text-3xl font-extrabold text-white tracking-tight">{isEditing ? 'Editar Sucursal' : 'Nueva Sucursal'}</h1>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleGuardar} className="px-8 pb-8 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Nombre de la Sede</label>
                                    <input
                                        type="text"
                                        required
                                        value={formNombre}
                                        onChange={(e) => setFormNombre(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                        placeholder="Ej: Almacén Central"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Tipo de Canal</label>
                                    <div className="relative">
                                        <select
                                            value={formTipo}
                                            onChange={(e) => setFormTipo(e.target.value)}
                                            className="w-full appearance-none px-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                        >
                                            <option value="Física">Tienda Física</option>
                                            <option value="Bodega">Bodega / Almacén</option>
                                            <option value="E-commerce">Canal Web</option>
                                            <option value="Digital">Digital / Bot</option>
                                            <option value="Distribuidor">Distribuidor</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Estado Operativo</label>
                                    <div className="flex p-1 bg-[#161B19] rounded-2xl h-[58px]">
                                        <button
                                            type="button"
                                            onClick={() => setFormActiva(true)}
                                            className={`flex-1 flex items-center justify-center rounded-[10px] text-xs font-bold tracking-widest uppercase transition-all duration-200 ${formActiva ? 'bg-[#22C55E] text-white' : 'text-gray-400 hover:text-gray-300'}`}
                                        >Activa</button>
                                        <button
                                            type="button"
                                            onClick={() => setFormActiva(false)}
                                            className={`flex-1 flex items-center justify-center rounded-[10px] text-xs font-bold tracking-widest uppercase transition-all duration-200 ${!formActiva ? 'bg-[#22C55E] text-white' : 'text-gray-400 hover:text-gray-300'}`}
                                        >Inactiva</button>
                                    </div>
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <label className="block text-[11px] font-bold tracking-widest text-[#22C55E] uppercase">Ubicación / Dirección / Endpoint</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </span>
                                        <input
                                            type="text"
                                            value={formUbicacion}
                                            onChange={(e) => setFormUbicacion(e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 rounded-2xl border-0 bg-[#161B19] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-[#22C55E] transition-all duration-200 focus:outline-none"
                                            placeholder="Dirección física o URL de conexión"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="w-full sm:flex-1 py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase text-gray-400 hover:bg-white/5 transition-colors"
                                >Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full sm:flex-[2] py-4 px-6 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase bg-[#22C55E] text-[#0A0C0B] hover:opacity-90 transition-all transform active:scale-[0.98] shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:shadow-none"
                                >
                                    {isSaving ? 'Procesando...' : isEditing ? 'Guardar Cambios' : 'Crear Sucursal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
