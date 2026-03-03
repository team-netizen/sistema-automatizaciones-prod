import { useState, useEffect } from 'react';
import { operacionesService } from '../services/operacionesService';

export const Reportes = () => {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReportes = async () => {
            setLoading(true);
            try {
                const data = await operacionesService.getReportes();
                setReportData(data);
            } catch (error) {
                console.error('Error al cargar reportes:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReportes();
    }, []);

    if (loading) return <div className="text-white font-black p-20 text-center animate-pulse">GENERANDO ANÁLISIS...</div>;

    // Proyección de demanda - Semanas del mes
    const projectionHeights = reportData?.proyeccion || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    return (
        <div className="space-y-8 animate-fadeIn w-full">
            {/* ── Report Header Card ──────────────────────── */}
            <div className="bg-[#111C19] border border-[#1F2D29] rounded-[32px] p-8 shadow-xl shadow-black/20">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#8B7AF0]/10 flex items-center justify-center text-[#8B7AF0] shadow-inner font-black text-xl">
                            📊
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Ventas & Análisis Global</h3>
                            <h2 className="text-3xl font-black text-white tracking-tight">Reporte Operativo Mensual</h2>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="bg-[#0B1412] border border-[#1F2D29] rounded-2xl px-6 py-4 flex items-center gap-3 shadow-inner">
                            <span className="text-sm font-black text-[#22C55E] tracking-widest uppercase">Marzo 2026</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></div>
                        </div>
                        <button className="h-14 px-10 bg-[#22C55E] text-[#0B1412] text-sm font-black rounded-2xl hover:bg-[#16A34A] transition-all shadow-2xl shadow-[#22C55E]/30 flex items-center gap-3 uppercase tracking-widest active:scale-95">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Exportar Reporte
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main Performance Row ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Proyección Chart */}
                <div className="lg:col-span-8 bg-[#111C19] border border-[#1F2D29] rounded-[40px] p-10 shadow-xl shadow-black/20 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-16">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-6 bg-[#22C55E] rounded-full"></div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Flujo de Demanda Proyectada</h3>
                        </div>
                    </div>

                    <div className="h-[280px] flex items-end justify-between px-2 gap-3 relative z-10">
                        {projectionHeights.map((h: number, i: number) => (
                            <div key={i} className="flex-1 group relative cursor-pointer group flex flex-col items-center">
                                {/* Bar Value on Hover */}
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#22C55E] text-[#0B1412] px-3 py-1.5 rounded-xl text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl shadow-[#22C55E]/30 z-20 whitespace-nowrap">
                                    {h}% Demanda
                                </div>

                                {/* The Bar */}
                                <div
                                    className={`w-full max-w-[44px] rounded-t-2xl transition-all duration-700 ease-out border-b-4 border-[#0B1412] shadow-sm ${i === projectionHeights.length - 1
                                        ? 'bg-gradient-to-t from-[#22C55E]/80 to-[#22C55E] shadow-2xl shadow-[#22C55E]/40'
                                        : i === 5
                                            ? 'bg-gradient-to-t from-[#8B7AF0]/80 to-[#8B7AF0] shadow-2xl shadow-[#8B7AF0]/20'
                                            : 'bg-[#1F2D29] hover:bg-[#22C55E]/40'
                                        }`}
                                    style={{ height: `${h}%` }}
                                ></div>

                                {/* Label */}
                                <span className="absolute -bottom-10 text-[9px] font-black text-gray-600 uppercase tracking-widest opacity-50 text-center w-full">S{i + 1}</span>
                            </div>
                        ))}
                    </div>

                    {/* Background Grid Lines */}
                    <div className="absolute inset-x-10 bottom-[120px] h-[1px] bg-[#1F2D29]/50 pointer-events-none z-0"></div>
                    <div className="absolute inset-x-10 bottom-[180px] h-[1px] bg-[#1F2D29]/50 pointer-events-none z-0"></div>
                    <div className="absolute inset-x-10 bottom-[240px] h-[1px] bg-[#1F2D29]/50 pointer-events-none z-0"></div>
                </div>

                {/* KPI Side Stack */}
                <div className="lg:col-span-4 space-y-8 flex flex-col">
                    <div className="flex-1 bg-[#111C19] border border-[#1F2D29] rounded-[40px] p-10 shadow-xl shadow-black/20 group hover:border-[#22C55E]/30 transition-all cursor-pointer relative overflow-hidden">
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-4">Ingresos Totales (Mes)</p>
                            <div>
                                <h3 className="text-5xl font-black text-white tracking-tighter mb-4">${reportData?.resumen?.ventas?.toLocaleString() || '0'}</h3>
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-xs font-black">↑</span>
                                    <span className="text-xs font-black text-[#22C55E] uppercase tracking-widest">0.0%</span>
                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest opacity-50">vs Mes Anterior</span>
                                </div>
                            </div>
                        </div>
                        {/* Abstract background shape */}
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#22C55E]/5 rounded-full blur-3xl group-hover:bg-[#22C55E]/10 transition-all"></div>
                    </div>

                    <div className="flex-1 bg-[#111C19] border border-[#1F2D29] rounded-[40px] p-10 shadow-xl shadow-black/20 group hover:border-[#8B7AF0]/30 transition-all cursor-pointer relative overflow-hidden">
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-4">Eficiencia Logística</p>
                            <div>
                                <h3 className="text-5xl font-black text-white tracking-tighter mb-4">98.2%</h3>
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8B7AF0]/10 text-[#8B7AF0] text-xs font-black">✓</span>
                                    <span className="text-xs font-black text-[#8B7AF0] uppercase tracking-widest">Optimizado</span>
                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest opacity-50">Alto Nivel</span>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#8B7AF0]/5 rounded-full blur-3xl group-hover:bg-[#8B7AF0]/10 transition-all"></div>
                    </div>
                </div>
            </div>

            {/* ── Detailed Performance Row ────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking Products */}
                <div className="bg-[#111C19] border border-[#1F2D29] rounded-[40px] p-10 shadow-xl shadow-black/20">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-12 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-orange-400 rounded-full"></span>
                        Ranking de Desempeño (Ventas)
                    </h3>
                    <div className="space-y-8">
                        {(!reportData?.top_productos || reportData.top_productos.length === 0) ? (
                            <div className="text-center py-20 bg-[#0B1412] rounded-3xl border border-dashed border-[#1F2D29]">
                                <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px]">Sin datos de ventas registrados</p>
                            </div>
                        ) : reportData.top_productos.map((prod: any, i: number) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex items-center gap-5">
                                        <span className="text-xs font-black text-gray-600 w-4 tracking-tighter">0{i + 1}</span>
                                        <div>
                                            <h4 className="text-base font-black text-white group-hover:text-[#22C55E] transition-colors tracking-tight">{prod.nombre}</h4>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{prod.ventas} Unidades Entregadas</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-white tracking-tight">${prod.ingresos.toLocaleString()}</span>
                                        <span className="block text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] mt-1">Ingresos Brutos</span>
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-[#0B1412] rounded-full overflow-hidden border border-[#1F2D29] shadow-inner p-0.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 shadow-lg ${i === 0 ? 'bg-[#22C55E] x-glow-[0_0_12px_rgba(34,197,94,0.4)]' : i === 1 ? 'bg-[#8B7AF0]' : 'bg-[#1F2D29]'}`}
                                        style={{ width: `${100 - (i * 15)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sales Channels Analysis */}
                <div className="bg-[#111C19] border border-[#1F2D29] rounded-[40px] p-10 shadow-xl shadow-black/20 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-12 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-cyan-400 rounded-full"></span>
                            Distribución Omnicanal
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {reportData?.canales.map((canal: any, i: number) => (
                                <div key={i} className="bg-[#0B1412] border border-[#1F2D29] rounded-[32px] p-8 text-center hover:border-white/10 transition-all hover:-translate-y-2 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-black/50 overflow-hidden relative group">
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center font-black text-sm border-2 shadow-inner transition-transform group-hover:scale-110" style={{ color: canal.color, borderColor: `${canal.color}30`, backgroundColor: `${canal.color}05` }}>
                                            {canal.porcentaje}%
                                        </div>
                                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1 opacity-60">{canal.nombre}</p>
                                        <span className="text-xs font-black text-white tracking-widest uppercase">Canal Primario</span>
                                    </div>
                                    <div className="absolute top-0 right-0 w-16 h-16 opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: canal.color, borderRadius: '0 0 0 100%' }}></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Recommendation Section */}
                    <div className="mt-12 p-8 bg-gradient-to-r from-[#22C55E]/10 to-transparent border border-[#22C55E]/10 rounded-[32px] flex items-center justify-between group cursor-pointer hover:border-[#22C55E]/30 transition-all shadow-xl shadow-black/20">
                        <div className="flex items-center gap-7">
                            <div className="w-16 h-16 rounded-[20px] bg-[#111C19] border border-[#1F2D29] flex items-center justify-center text-[#22C55E] shadow-xl group-hover:scale-105 transition-transform text-2xl">
                                ✨
                            </div>
                            <div className="max-w-[280px]">
                                <h4 className="text-sm font-black text-white tracking-widest uppercase mb-1.5">Análisis Predictivo AI</h4>
                                <p className="text-xs text-gray-500 font-bold leading-relaxed tracking-tight">"Detectamos una oportunidad de crecimiento del 12% en el canal WhatsApp reponiendo Periféricos antes del fin de semana."</p>
                            </div>
                        </div>
                        <button className="w-12 h-12 bg-[#22C55E] rounded-2xl flex items-center justify-center text-[#0B1412] shadow-xl shadow-[#22C55E]/30 hover:scale-110 active:scale-95 transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
