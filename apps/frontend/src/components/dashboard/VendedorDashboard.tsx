import { useEffect, useMemo, useState } from 'react';
import AlertasSucursal from './AlertasSucursal';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

type SectionId = 'inicio' | 'nueva_venta' | 'mis_ventas' | 'stock' | 'notificaciones';
type VentaStep = 1 | 2 | 3;
type PeriodoVentas = 'hoy' | 'semana' | 'mes';
type MetodoPago = 'efectivo' | 'tarjeta' | 'yape_plin' | 'transferencia';

interface VendedorDashboardProps {
  usuario: { id: string; nombre: string; email: string; rol: string; empresa_id: string; sucursal_id: string; sucursal_nombre: string };
  token: string;
  onLogout: () => void;
}

const T = {
  bg: '#f5f6fa', surface: '#ffffff', accent: '#2d6a4f', accentLight: '#d1fae5', text: '#1a1a2e',
  textMuted: '#6b7280', border: '#e8ecf0', danger: '#dc2626', dangerLight: '#fee2e2',
  warning: '#d97706', warningLight: '#fef3c7', success: '#2d6a4f', successLight: '#d1fae5',
  shadow: '0 10px 30px rgba(15, 23, 42, 0.08)', radius: '18px', radiusSm: '10px',
};

const NAV: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'nueva_venta', label: 'Nueva venta', icon: '🛒' },
  { id: 'mis_ventas', label: 'Mis ventas', icon: '📋' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
];

const cardStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow };
const inputStyle = { background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, color: T.text, fontSize: 13, outline: 'none', padding: '10px 12px', width: '100%' };
const ghostButton = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, color: T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '10px 14px' };

const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
const formatDate = (value: string) => (!value ? '-' : new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
const toDateInput = (date: Date) => date.toISOString().split('T')[0];
const csvEscape = (value: unknown) => (/[",\n]/.test(String(value ?? '')) ? `"${String(value ?? '').replace(/"/g, '""')}"` : String(value ?? ''));
const downloadCsv = (name: string, headers: string[], rows: Array<Array<unknown>>) => {
  const blob = new Blob([`\ufeff${[headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

function getRange(periodo: PeriodoVentas) {
  const now = new Date();
  const hasta = toDateInput(now);
  if (periodo === 'hoy') return { desde: hasta, hasta };
  if (periodo === 'semana') {
    const copy = new Date(now);
    copy.setDate(copy.getDate() - (copy.getDay() === 0 ? 6 : copy.getDay() - 1));
    return { desde: toDateInput(copy), hasta };
  }
  return { desde: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), hasta };
}

function badgeTone(estado: string) {
  const key = String(estado || '').toLowerCase();
  if (['entregado', 'ok', 'completada'].includes(key)) return { bg: T.successLight, color: T.success };
  if (['cancelado', 'rechazado', 'sin_stock'].includes(key)) return { bg: T.dangerLight, color: T.danger };
  if (['pendiente', 'bajo'].includes(key)) return { bg: T.warningLight, color: T.warning };
  return { bg: '#f3f4f6', color: T.textMuted };
}

function Spinner() {
  return <div style={{ animation: 'vendedor-spin 1s linear infinite', border: `3px solid ${T.border}`, borderRadius: '50%', borderTopColor: T.accent, height: 26, width: 26 }} />;
}

export default function VendedorDashboard({ usuario, token, onLogout }: VendedorDashboardProps) {
  const apiBase = 'https://sistema-automatizaciones-backend.onrender.com';
  const empresaId = String(usuario?.empresa_id || '');
  const sucursalId = String(usuario?.sucursal_id || '');
  const usuarioId = String(usuario?.id || '');
  const usuarioNombre = usuario?.nombre || usuario?.email || 'Vendedor';
  const nombreSucursal = String(usuario?.sucursal_nombre || '').trim() || 'Mi sucursal';
  const [section, setSection] = useState<SectionId>('inicio');
  const [resumen, setResumen] = useState<any>(null);
  const [resumenLoading, setResumenLoading] = useState(true);
  const [resumenError, setResumenError] = useState('');
  const [ventaStep, setVentaStep] = useState<VentaStep>(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', dni: '', email: '' });
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [ventaError, setVentaError] = useState('');
  const [ventaOk, setVentaOk] = useState<any>(null);
  const [periodo, setPeriodo] = useState<PeriodoVentas>('hoy');
  const [estadoVentas, setEstadoVentas] = useState('todos');
  const [ventas, setVentas] = useState<any[]>([]);
  const [ventasLoading, setVentasLoading] = useState(false);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (section !== 'inicio') return;
    const load = async () => {
      setResumenLoading(true);
      try {
        setResumen(await operacionesService.getResumenTurnoVendedor({ sucursalId, empresaId, vendedorId: usuarioId }));
        setResumenError('');
      } catch (error) {
        setResumenError(error instanceof Error ? error.message : 'No se pudo cargar el resumen.');
      } finally {
        setResumenLoading(false);
      }
    };
    void load();
  }, [section, empresaId, sucursalId, usuarioId, reloadKey]);

  useEffect(() => {
    if (section !== 'nueva_venta' || ventaStep !== 1 || !debouncedSearch) {
      if (!debouncedSearch) setResults([]);
      return;
    }
    void operacionesService.buscarProductosParaVenta({ q: debouncedSearch, sucursalId, empresaId }).then((data) => setResults(Array.isArray(data) ? data : []));
  }, [section, ventaStep, debouncedSearch, sucursalId, empresaId]);

  useEffect(() => {
    if (section !== 'mis_ventas') return;
    const load = async () => {
      setVentasLoading(true);
      try {
        const range = getRange(periodo);
        const data = await operacionesService.getMisVentasVendedor({ vendedorId: usuarioId, sucursalId, empresaId, desde: range.desde, hasta: range.hasta });
        setVentas(Array.isArray(data) ? data : []);
      } finally {
        setVentasLoading(false);
      }
    };
    void load();
  }, [section, periodo, sucursalId, empresaId, usuarioId, reloadKey]);

  useEffect(() => {
    if (section !== 'stock') return;
    const load = async () => {
      setStockLoading(true);
      try {
        const params = new URLSearchParams({ sucursalId, empresaId });
        const response = await fetch(`${apiBase}/api/operaciones/reportes/stock-sucursal?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json();
        setStockRows(Array.isArray(payload) ? payload : []);
      } finally {
        setStockLoading(false);
      }
    };
    void load();
  }, [section, apiBase, token, sucursalId, empresaId]);

  const totalCart = cart.reduce((sum, row) => sum + row.cantidad * row.precio, 0);
  const filteredVentas = useMemo(() => ventas.filter((row) => estadoVentas === 'todos' || String(row.estado || '').toLowerCase() === estadoVentas), [ventas, estadoVentas]);
  const filteredStock = useMemo(() => stockRows.filter((row) => !stockSearch.trim() || row.nombre.toLowerCase().includes(stockSearch.toLowerCase()) || row.sku.toLowerCase().includes(stockSearch.toLowerCase())), [stockRows, stockSearch]);
  const ventasTotal = filteredVentas.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const notifNoLeidas = Number(resumen?.alertasPendientes || 0);

  const addToCart = (row: any) => setCart((prev) => {
    const found = prev.find((item) => item.id === row.id);
    if (found) return prev.map((item) => item.id === row.id && item.cantidad < item.stock_disponible ? { ...item, cantidad: item.cantidad + 1 } : item);
    return [...prev, { ...row, cantidad: 1 }];
  });

  const updateQty = (id: string, delta: number) => setCart((prev) => prev.map((row) => row.id === id ? { ...row, cantidad: row.cantidad + delta } : row).filter((row) => row.cantidad > 0));

  const resetVenta = () => {
    setVentaStep(1);
    setSearch('');
    setResults([]);
    setCart([]);
    setCliente({ nombre: '', telefono: '', dni: '', email: '' });
    setMetodoPago('efectivo');
    setMontoRecibido('');
    setObservaciones('');
    setVentaError('');
    setVentaOk(null);
  };

  const confirmarVenta = async () => {
    if (!cart.length) return setVentaError('Debes agregar al menos un producto.');
    if (metodoPago === 'efectivo' && Number(montoRecibido || 0) < totalCart) return setVentaError('El monto recibido debe cubrir el total.');
    const response = await operacionesService.crearPedidoVendedor({
      empresaId, sucursalId, vendedorId: usuarioId,
      items: cart.map((row) => ({ productoId: row.id, cantidad: row.cantidad, precioUnitario: row.precio })),
      cliente, metodoPago, montoRecibido: metodoPago === 'efectivo' ? Number(montoRecibido || 0) : undefined, observaciones,
    });
    setVentaOk(response?.pedido);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <div style={{ background: T.bg, color: T.text, display: 'flex', fontFamily: "'DM Sans', 'Nunito', sans-serif", height: '100vh', overflow: 'hidden' }}>
      <style>{`@keyframes vendedor-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <aside style={{ background: T.surface, borderRight: `1px solid ${T.border}`, boxShadow: '6px 0 18px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', overflowY: 'auto', padding: 20, width: 220 }}>
        <div style={{ marginBottom: 24 }}><div style={{ color: T.accent, fontSize: 22, fontWeight: 800 }}>SIS AUTO</div><div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>Panel de vendedor</div></div>
        <nav style={{ display: 'grid', gap: 8 }}>{NAV.map((item) => <button key={item.id} onClick={() => setSection(item.id)} type="button" style={{ alignItems: 'center', background: section === item.id ? T.accentLight : 'transparent', border: `1px solid ${section === item.id ? '#b7e4c7' : 'transparent'}`, borderRadius: 12, color: section === item.id ? T.accent : T.textMuted, cursor: 'pointer', display: 'flex', fontSize: 14, fontWeight: section === item.id ? 700 : 600, gap: 10, justifyContent: 'space-between', padding: '12px 14px', textAlign: 'left' }}><span style={{ alignItems: 'center', display: 'inline-flex', gap: 10 }}><span>{item.icon}</span><span>{item.label}</span></span>{item.id === 'notificaciones' && <span style={{ background: T.danger, borderRadius: 999, color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, padding: '3px 6px', textAlign: 'center' }}>{notifNoLeidas}</span>}</button>)}</nav>
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 'auto', paddingTop: 16 }}><button onClick={onLogout} type="button" style={{ alignItems: 'center', background: 'transparent', border: '1px solid transparent', borderRadius: 12, color: T.textMuted, cursor: 'pointer', display: 'flex', fontSize: 14, fontWeight: 600, gap: 10, padding: '12px 14px', width: '100%' }}><span>↩</span><span>Cerrar sesion</span></button></div>
      </aside>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: '100vh', minWidth: 0, overflow: 'hidden' }}>
        <header style={{ alignItems: 'center', background: '#ffffff', borderBottom: '1.5px solid #e8ecf0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', minHeight: 60, padding: '2px 24px 8px', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ color: '#1a1a2e', fontSize: 14, fontWeight: 600 }}>SIS AUTO / Panel de vendedor</span>
          <div style={{ alignItems: 'center', background: '#d1fae5', borderRadius: '20px', color: '#2d6a4f', display: 'flex', fontSize: 13, fontWeight: 600, gap: '6px', padding: '6px 14px' }}>
            <span>📍</span>
            <span>{nombreSucursal}</span>
          </div>
          <div style={{ alignItems: 'center', display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
            <div
              onClick={() => setSection('notificaciones')}
              style={{
                alignItems: 'center',
                borderRadius: '8px',
                color: '#1a1a2e',
                cursor: 'pointer',
                display: 'flex',
                fontSize: '13px',
                fontWeight: 500,
                gap: '6px',
                padding: '4px 8px',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span>Alertas</span>
              {notifNoLeidas > 0 && (
                <span style={{ background: '#dc2626', borderRadius: '10px', color: '#fff', fontSize: '10px', fontWeight: 700, marginLeft: '2px', padding: '1px 5px' }}>
                  {notifNoLeidas}
                </span>
              )}
            </div>
            <div style={{ alignItems: 'center', cursor: 'pointer', display: 'flex', gap: '10px' }}>
              <div style={{ alignItems: 'center', background: '#2d6a4f', borderRadius: '50%', color: '#fff', display: 'flex', flexShrink: 0, fontSize: '13px', fontWeight: 700, height: '34px', justifyContent: 'center', width: '34px' }}>
                {(usuario.nombre || usuario.email || 'V').charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#1a1a2e', fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>
                  {usuario.email || usuarioNombre}
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: 1.3 }}>
                  {usuario.rol}
                </div>
              </div>
            </div>
          </div>
        </header>
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100%', padding: 24 }}>
          <div style={{ marginBottom: 20 }}><div style={{ color: T.text, fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Dashboard de vendedor</div><div style={{ color: T.textMuted, fontSize: 14 }}>Gestiona ventas POS, consulta stock y revisa tus notificaciones.</div></div>

          {section === 'inicio' && (resumenLoading ? <div style={{ ...cardStyle, display: 'grid', justifyItems: 'center', minHeight: 220, padding: 24, rowGap: 12 }}><Spinner /><div style={{ color: T.textMuted, fontSize: 13 }}>Cargando resumen...</div></div> : resumenError ? <div style={{ ...cardStyle, color: T.danger, fontSize: 13, fontWeight: 700, padding: 20 }}>{resumenError}</div> : <div style={{ display: 'grid', gap: 16 }}><div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>{[{ label: 'Ventas hoy', value: String(resumen?.ventasHoy || 0), hint: 'pedidos' }, { label: 'Total S/', value: money(resumen?.ingresosHoy || 0), hint: 'en ventas' }, { label: 'Productos con stock OK', value: `${resumen?.stockOk || 0} / ${resumen?.stockTotal || 0}`, hint: 'en sucursal' }, { label: 'Alertas pendientes', value: String(resumen?.alertasPendientes || 0), hint: 'sin leer' }].map((item) => <div key={item.label} style={{ ...cardStyle, display: 'grid', gap: 8, padding: '20px 22px' }}><div style={{ color: T.textMuted, fontSize: 13, fontWeight: 700 }}>{item.label}</div><div style={{ color: T.text, fontSize: 28, fontWeight: 800 }}>{item.value}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{item.hint}</div></div>)}</div><div style={{ ...cardStyle, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={{ background: '#f9fbfc' }}>{['N Pedido', 'Cliente', 'Total', 'Metodo pago', 'Estado', 'Hora'].map((label) => <th key={label} style={{ color: T.textMuted, fontSize: 12, fontWeight: 800, padding: '14px 16px', textAlign: 'left' }}>{label}</th>)}</tr></thead><tbody>{resumen?.ultimasVentas?.length ? resumen.ultimasVentas.map((row: any) => { const badge = badgeTone(row.estado); return <tr key={row.id} style={{ borderTop: `1px solid ${T.border}` }}><td style={{ color: T.text, fontWeight: 700, padding: '14px 16px' }}>{row.numero}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{row.nombre_cliente}</td><td style={{ color: T.text, padding: '14px 16px' }}>{money(row.total)}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{String(row.metodo_pago || '').replace('_', '/')}</td><td style={{ padding: '14px 16px' }}><span style={{ background: badge.bg, borderRadius: 999, color: badge.color, display: 'inline-flex', fontSize: 12, fontWeight: 700, padding: '5px 10px', textTransform: 'capitalize' }}>{row.estado}</span></td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{formatDate(row.fecha_pedido)}</td></tr>; }) : <tr><td colSpan={6} style={{ color: T.textMuted, padding: '24px 16px', textAlign: 'center' }}>Aun no registras ventas hoy.</td></tr>}</tbody></table></div></div></div>)}

          {section === 'nueva_venta' && <div style={{ display: 'grid', gap: 16 }}><div style={{ ...cardStyle, display: 'grid', gap: 16, padding: 20 }}><div style={{ color: T.text, fontSize: 25, fontWeight: 800 }}>Nueva venta</div><div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999, display: 'flex', gap: 8, padding: 6 }}>{[1, 2, 3].map((step) => <button key={step} onClick={() => { if (step === 1 || cart.length) setVentaStep(step as VentaStep); }} type="button" style={{ background: ventaStep === step ? T.surface : 'transparent', border: `1px solid ${ventaStep === step ? T.border : 'transparent'}`, borderRadius: 999, boxShadow: ventaStep === step ? '0 6px 20px rgba(15, 23, 42, 0.08)' : 'none', color: ventaStep === step ? T.text : T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '10px 14px' }}>{step}. {step === 1 ? 'Productos' : step === 2 ? 'Cliente' : 'Cobro'}</button>)}</div></div>{ventaStep === 1 && <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.1fr 0.9fr' }}><div style={{ ...cardStyle, display: 'grid', gap: 12, padding: 20 }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar SKU o producto" style={inputStyle} /><div style={{ display: 'grid', gap: 10 }}>{results.map((row) => <div key={row.id} style={{ alignItems: 'center', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, display: 'grid', gap: 10, gridTemplateColumns: '1fr auto', padding: '12px 14px' }}><div><div style={{ color: T.text, fontWeight: 800 }}>{row.nombre}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{row.sku} · {money(row.precio)} · stock {row.stock_disponible}</div></div><button disabled={row.stock_disponible <= 0} onClick={() => addToCart(row)} type="button" style={{ background: row.stock_disponible <= 0 ? '#edf0f4' : T.accent, border: 'none', borderRadius: T.radiusSm, color: row.stock_disponible <= 0 ? T.textMuted : '#fff', cursor: row.stock_disponible <= 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, padding: '10px 12px' }}>Agregar</button></div>)}</div></div><div style={{ ...cardStyle, display: 'grid', gap: 12, padding: 20 }}><div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>Carrito</div><div style={{ color: T.textMuted, fontSize: 13 }}>{cart.length} item(s) · {money(totalCart)}</div><div style={{ display: 'grid', gap: 10 }}>{cart.length ? cart.map((row) => <div key={row.id} style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, display: 'grid', gap: 8, padding: '12px 14px' }}><div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}><div><div style={{ color: T.text, fontWeight: 800 }}>{row.nombre}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{money(row.precio)}</div></div><div style={{ color: T.text, fontWeight: 800 }}>{money(row.cantidad * row.precio)}</div></div><div style={{ alignItems: 'center', display: 'flex', gap: 8 }}><button onClick={() => updateQty(row.id, -1)} style={ghostButton} type="button">-</button><div style={{ color: T.text, fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{row.cantidad}</div><button onClick={() => updateQty(row.id, 1)} style={ghostButton} type="button">+</button></div></div>) : <div style={{ color: T.textMuted, fontSize: 13 }}>El carrito esta vacio.</div>}</div><button disabled={!cart.length} onClick={() => setVentaStep(2)} type="button" style={{ background: !cart.length ? '#edf0f4' : T.accent, border: 'none', borderRadius: T.radiusSm, color: !cart.length ? T.textMuted : '#fff', cursor: !cart.length ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 14px' }}>Continuar</button></div></div>}{ventaStep === 2 && <div style={{ ...cardStyle, display: 'grid', gap: 12, maxWidth: 760, padding: 20 }}><div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>Datos del cliente</div><div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>{['nombre', 'telefono', 'dni', 'email'].map((field) => <input key={field} placeholder={field[0].toUpperCase() + field.slice(1)} style={inputStyle} value={(cliente as any)[field]} onChange={(e) => setCliente((prev) => ({ ...prev, [field]: e.target.value }))} />)}</div><div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}><button onClick={() => setVentaStep(1)} style={ghostButton} type="button">Volver</button><button onClick={() => setVentaStep(3)} type="button" style={{ ...ghostButton, background: T.accent, border: 'none', color: '#fff' }}>Continuar</button></div></div>}{ventaStep === 3 && <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 0.95fr' }}><div style={{ ...cardStyle, display: 'grid', gap: 10, padding: 20 }}><div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>Resumen del pedido</div>{cart.map((row) => <div key={row.id} style={{ alignItems: 'center', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', padding: '12px 14px' }}><div><div style={{ color: T.text, fontWeight: 700 }}>{row.nombre}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{row.cantidad} x {money(row.precio)}</div></div><div style={{ color: T.text, fontWeight: 800 }}>{money(row.cantidad * row.precio)}</div></div>)}<div style={{ color: T.text, fontSize: 22, fontWeight: 800 }}>Total: {money(totalCart)}</div></div><div style={{ ...cardStyle, display: 'grid', gap: 12, padding: 20 }}><div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>Cobro</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{['efectivo', 'tarjeta', 'yape_plin', 'transferencia'].map((item) => <button key={item} onClick={() => setMetodoPago(item as MetodoPago)} type="button" style={{ background: metodoPago === item ? T.accentLight : T.bg, border: `1px solid ${metodoPago === item ? '#b7e4c7' : T.border}`, borderRadius: 999, color: metodoPago === item ? T.accent : T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '9px 12px', textTransform: 'capitalize' }}>{item.replace('_', '/')}</button>)}</div>{metodoPago === 'efectivo' && <><input type="number" min={0} placeholder="Monto recibido" style={inputStyle} value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} /><div style={{ color: T.textMuted, fontSize: 13 }}>Vuelto: {money(Math.max(0, Number(montoRecibido || 0) - totalCart))}</div></>}<textarea placeholder="Observaciones" style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />{ventaError && <div style={{ color: T.danger, fontSize: 12 }}>{ventaError}</div>}<div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}><button onClick={() => setVentaStep(2)} style={ghostButton} type="button">Volver</button><button onClick={() => void confirmarVenta()} type="button" style={{ background: T.accent, border: 'none', borderRadius: T.radiusSm, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 14px' }}>Confirmar venta</button></div></div></div>}{ventaOk && <div onClick={() => setVentaOk(null)} style={{ alignItems: 'center', background: 'rgba(15, 23, 42, 0.32)', display: 'flex', inset: 0, justifyContent: 'center', padding: 24, position: 'fixed', zIndex: 120 }}><div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, display: 'grid', gap: 14, maxWidth: 420, padding: 24, textAlign: 'center', width: '100%' }}><div style={{ color: T.text, fontSize: 22, fontWeight: 800 }}>Venta registrada</div><div style={{ color: T.textMuted, fontSize: 14 }}>Pedido generado: <strong>{ventaOk.numero}</strong></div><div style={{ color: T.textMuted, fontSize: 14 }}>Total: {money(ventaOk.total)}</div><button onClick={resetVenta} type="button" style={{ background: T.accent, border: 'none', borderRadius: T.radiusSm, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 14px' }}>Nueva venta</button></div></div>}</div>}

          {section === 'mis_ventas' && <div style={{ display: 'grid', gap: 16 }}><div style={{ ...cardStyle, display: 'grid', gap: 14, padding: 20 }}><div style={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between' }}><div><div style={{ color: T.text, fontSize: 25, fontWeight: 800 }}>Mis ventas</div><div style={{ color: T.textMuted, fontSize: 14, marginTop: 6 }}>Historial POS generado desde tu usuario.</div></div><button disabled={!filteredVentas.length} onClick={() => { const range = getRange(periodo); downloadCsv(`mis_ventas_${nombreSucursal}_${range.desde}_${range.hasta}.csv`, ['N Pedido', 'Fecha', 'Cliente', 'Items', 'Total', 'Metodo pago', 'Estado'], filteredVentas.map((row) => [row.numero, row.fecha_pedido, row.nombre_cliente, row.items_count, row.total, row.metodo_pago, row.estado])); }} type="button" style={{ background: !filteredVentas.length ? '#edf0f4' : T.accent, border: 'none', borderRadius: T.radiusSm, color: !filteredVentas.length ? T.textMuted : '#fff', cursor: !filteredVentas.length ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 14px' }}>Exportar CSV</button></div><div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between' }}><div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999, display: 'flex', gap: 8, padding: 6 }}>{['hoy', 'semana', 'mes'].map((item) => <button key={item} onClick={() => setPeriodo(item as PeriodoVentas)} type="button" style={{ background: periodo === item ? T.surface : 'transparent', border: `1px solid ${periodo === item ? T.border : 'transparent'}`, borderRadius: 999, boxShadow: periodo === item ? '0 6px 20px rgba(15, 23, 42, 0.08)' : 'none', color: periodo === item ? T.text : T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '10px 14px' }}>{item === 'hoy' ? 'Hoy' : item === 'semana' ? 'Esta semana' : 'Este mes'}</button>)}</div><select value={estadoVentas} onChange={(e) => setEstadoVentas(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }}><option value="todos">Todos</option><option value="pendiente">Pendiente</option><option value="entregado">Entregado</option><option value="cancelado">Cancelado</option></select></div></div><div style={{ ...cardStyle, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={{ background: '#f9fbfc' }}>{['N Pedido', 'Fecha/Hora', 'Cliente', 'Items', 'Total', 'Metodo pago', 'Estado'].map((label) => <th key={label} style={{ color: T.textMuted, fontSize: 12, fontWeight: 800, padding: '14px 16px', textAlign: 'left' }}>{label}</th>)}</tr></thead><tbody>{ventasLoading ? <tr><td colSpan={7} style={{ color: T.textMuted, padding: '24px 16px', textAlign: 'center' }}>Cargando ventas...</td></tr> : filteredVentas.length ? filteredVentas.map((row) => { const badge = badgeTone(row.estado); return <tr key={row.id} style={{ borderTop: `1px solid ${T.border}` }}><td style={{ color: T.text, fontWeight: 700, padding: '14px 16px' }}>{row.numero}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{formatDate(row.fecha_pedido)}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{row.nombre_cliente}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{row.items_count}</td><td style={{ color: T.text, padding: '14px 16px' }}>{money(row.total)}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{String(row.metodo_pago || '').replace('_', '/')}</td><td style={{ padding: '14px 16px' }}><span style={{ background: badge.bg, borderRadius: 999, color: badge.color, display: 'inline-flex', fontSize: 12, fontWeight: 700, padding: '5px 10px', textTransform: 'capitalize' }}>{row.estado}</span></td></tr>; }) : <tr><td colSpan={7} style={{ color: T.textMuted, padding: '24px 16px', textAlign: 'center' }}>No hay ventas para los filtros seleccionados.</td></tr>}</tbody></table></div></div><div style={{ ...cardStyle, color: T.textMuted, fontSize: 13, padding: '14px 18px' }}>{filteredVentas.length} ventas · Total: {money(ventasTotal)} · Promedio: {money(filteredVentas.length ? ventasTotal / filteredVentas.length : 0)}</div></div>}

          {section === 'stock' && <div style={{ display: 'grid', gap: 16 }}><div style={{ ...cardStyle, display: 'grid', gap: 14, padding: 20 }}><div style={{ color: T.text, fontSize: 25, fontWeight: 800 }}>Stock</div><input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Buscar por SKU o producto" style={{ ...inputStyle, maxWidth: 320 }} /></div><div style={{ ...cardStyle, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={{ background: '#f9fbfc' }}>{['SKU', 'Producto', 'Cantidad', 'Minimo', 'Estado'].map((label) => <th key={label} style={{ color: T.textMuted, fontSize: 12, fontWeight: 800, padding: '14px 16px', textAlign: 'left' }}>{label}</th>)}</tr></thead><tbody>{stockLoading ? <tr><td colSpan={5} style={{ color: T.textMuted, padding: '24px 16px', textAlign: 'center' }}>Cargando stock...</td></tr> : filteredStock.length ? filteredStock.map((row) => { const badge = badgeTone(row.estado); return <tr key={row.producto_id} style={{ borderTop: `1px solid ${T.border}` }}><td style={{ color: T.textMuted, fontFamily: 'monospace', padding: '14px 16px' }}>{row.sku}</td><td style={{ color: T.text, fontWeight: 700, padding: '14px 16px' }}>{row.nombre}</td><td style={{ color: T.text, padding: '14px 16px' }}>{row.cantidad}</td><td style={{ color: T.textMuted, padding: '14px 16px' }}>{row.stock_minimo}</td><td style={{ padding: '14px 16px' }}><span style={{ background: badge.bg, borderRadius: 999, color: badge.color, display: 'inline-flex', fontSize: 12, fontWeight: 700, padding: '5px 10px', textTransform: 'capitalize' }}>{row.estado}</span></td></tr>; }) : <tr><td colSpan={5} style={{ color: T.textMuted, padding: '24px 16px', textAlign: 'center' }}>No hay productos para mostrar.</td></tr>}</tbody></table></div></div></div>}

          {section === 'notificaciones' && <AlertasSucursal usuarioId={usuarioId} empresaId={empresaId} token={token} apiBase={apiBase} />}
        </main>
      </div>
    </div>
  );
}
