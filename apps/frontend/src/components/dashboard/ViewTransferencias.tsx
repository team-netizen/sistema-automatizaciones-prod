// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const T = {
  bg: '#07090b',
  surface: '#0b0f12',
  surface2: '#0f1419',
  border: '#151d24',
  border2: '#1c2830',
  accent: '#00e87b',
  accentDim: '#00e87b18',
  text: '#e8f5ee',
  textMid: '#4d6b58',
  textDim: '#2a3f30',
  font: 'DM Sans',
  fontMono: 'DM Mono',
  fontDisplay: 'DM Sans',
};

const inputStyle = {
  background: T.surface2,
  border: `1px solid ${T.border2}`,
  color: T.text,
  borderRadius: 8,
  fontSize: 12,
  fontFamily: `${T.font}, sans-serif`,
  outline: 'none',
  padding: '9px 11px',
};

const btnStyle = {
  background: T.accentDim,
  border: `1px solid ${T.accent}44`,
  color: T.accent,
  borderRadius: 8,
  fontSize: 12,
  fontFamily: `${T.font}, sans-serif`,
  fontWeight: 700,
  padding: '8px 12px',
  cursor: 'pointer',
};

const btnGhost = {
  background: T.surface2,
  border: `1px solid ${T.border2}`,
  color: T.textMid,
  borderRadius: 8,
  fontSize: 12,
  fontFamily: `${T.font}, sans-serif`,
  fontWeight: 700,
  padding: '8px 12px',
  cursor: 'pointer',
};

const getBadgeEstado = (estado: string) => {
  const colores: Record<string, { bg: string; color: string }> = {
    pendiente: { bg: '#f59e0b18', color: '#f59e0b' },
    aprobada: { bg: '#00e87b18', color: '#00e87b' },
    rechazada: { bg: '#ef444418', color: '#ef4444' },
    en_transito: { bg: '#3b82f618', color: '#3b82f6' },
    completada: { bg: '#4d6b5818', color: '#4d6b58' },
  };
  const c = colores[estado] || { bg: '#4d6b5818', color: '#4d6b58' };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'capitalize',
      }}
    >
      {String(estado || '').replace('_', ' ')}
    </span>
  );
};

interface ViewTransferenciasProps {
  usuario?: any;
}

export const ViewTransferencias = ({ usuario }: ViewTransferenciasProps) => {
  void usuario;

  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');

  // Modal crear transferencia
  const [modalCrear, setModalCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState('');

  // Formulario nueva transferencia
  const [form, setForm] = useState({
    sucursal_origen_id: '',
    sucursal_destino_id: '',
    notas: '',
    aprobacion_requerida: true,
  });
  const [items, setItems] = useState<Array<{ producto_id: string; cantidad_enviada: number }>>([
    { producto_id: '', cantidad_enviada: 1 },
  ]);

  // Modal detalle/aprobar
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<any>(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  useEffect(() => {
    void Promise.all([
      cargarTransferencias(),
      operacionesService.getSucursales(),
      operacionesService.getProductos(),
    ]).then(([_, sucRes, prodRes]) => {
      setSucursales(sucRes?.sucursales || []);
      setProductos(prodRes?.productos || []);
    });
  }, []);

  const cargarTransferencias = async () => {
    setLoading(true);
    try {
      const res = await operacionesService.getTransferencias();
      setTransferencias(res?.transferencias || []);
    } finally {
      setLoading(false);
    }
  };

  const transferenciasFiltradas = transferencias.filter((t) => {
    const coincideEstado = filtroEstado === 'todos' || t.estado === filtroEstado;
    const coincideSucursal =
      filtroSucursal === 'todas'
      || t.sucursal_origen_id === filtroSucursal
      || t.sucursal_destino_id === filtroSucursal;
    return coincideEstado && coincideSucursal;
  });

  const sucursalesById = useMemo(() => {
    const map: Record<string, any> = {};
    sucursales.forEach((s) => {
      map[String(s?.id || '')] = s;
    });
    return map;
  }, [sucursales]);

  const productosById = useMemo(() => {
    const map: Record<string, any> = {};
    productos.forEach((p) => {
      map[String(p?.id || '')] = p;
    });
    return map;
  }, [productos]);

  const getSucursalNombre = (id?: string, embebida?: any) =>
    embebida?.nombre || sucursalesById[String(id || '')]?.nombre || id || '-';

  const getStockDisponible = (productoId: string, sucursalId: string) => {
    const p = productosById[String(productoId || '')];
    const rows = Array.isArray(p?.stock_por_sucursal) ? p.stock_por_sucursal : [];
    const row = rows.find(
      (r: any) => String(r?.sucursal_id || r?.sucursal?.id || '') === String(sucursalId || ''),
    );
    return Number(row?.cantidad || 0);
  };

  const abrirCrear = () => {
    setErrorCrear('');
    setForm({
      sucursal_origen_id: '',
      sucursal_destino_id: '',
      notas: '',
      aprobacion_requerida: true,
    });
    setItems([{ producto_id: '', cantidad_enviada: 1 }]);
    setModalCrear(true);
  };

  const abrirDetalle = (t: any) => {
    setTransferenciaSeleccionada(t);
    setMotivoRechazo('');
    setModalDetalle(true);
  };

  const onAddItem = () => setItems((prev) => [...prev, { producto_id: '', cantidad_enviada: 1 }]);
  const onRemoveItem = (index: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const onChangeItem = (index: number, key: 'producto_id' | 'cantidad_enviada', value: any) =>
    setItems((prev) =>
      prev.map((it, i) =>
        i !== index
          ? it
          : key === 'cantidad_enviada'
            ? { ...it, cantidad_enviada: Number(value || 0) }
            : { ...it, producto_id: String(value || '') },
      ),
    );

  const crearTransferencia = async (e: any) => {
    e.preventDefault();
    setErrorCrear('');
    if (!form.sucursal_origen_id || !form.sucursal_destino_id) {
      setErrorCrear('Debes seleccionar sucursal origen y destino.');
      return;
    }
    if (form.sucursal_origen_id === form.sucursal_destino_id) {
      setErrorCrear('La sucursal origen y destino no pueden ser la misma.');
      return;
    }

    const validItems = items.filter((i) => i.producto_id && Number(i.cantidad_enviada) > 0);
    if (validItems.length === 0) {
      setErrorCrear('Debes agregar al menos un item valido con cantidad > 0.');
      return;
    }

    const ids = new Set<string>();
    for (const it of validItems) {
      if (ids.has(it.producto_id)) {
        setErrorCrear('No se permite repetir producto.');
        return;
      }
      ids.add(it.producto_id);
    }

    for (const it of validItems) {
      const disponible = getStockDisponible(it.producto_id, form.sucursal_origen_id);
      if (Number(it.cantidad_enviada) > disponible) {
        const nombre = productosById[it.producto_id]?.nombre || it.producto_id;
        setErrorCrear(
          `Stock insuficiente para ${nombre}. Disponible ${disponible}, solicitado ${it.cantidad_enviada}`,
        );
        return;
      }
    }

    setCreando(true);
    try {
      await operacionesService.crearTransferencia({
        sucursal_origen_id: form.sucursal_origen_id,
        sucursal_destino_id: form.sucursal_destino_id,
        notas: form.notas || undefined,
        aprobacion_requerida: form.aprobacion_requerida,
        items: validItems.map((i) => ({
          producto_id: i.producto_id,
          cantidad_enviada: Number(i.cantidad_enviada),
        })),
      });
      setModalCrear(false);
      await cargarTransferencias();
    } catch (err: any) {
      setErrorCrear(err?.message || 'Error al crear transferencia');
    } finally {
      setCreando(false);
    }
  };

  const aprobarTransferencia = async (id: string) => {
    setProcesando(true);
    try {
      await operacionesService.aprobarTransferencia(id);
      await cargarTransferencias();
      setModalDetalle(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const rechazarTransferencia = async (id: string, motivo: string) => {
    setProcesando(true);
    try {
      await operacionesService.rechazarTransferencia(id, motivo);
      await cargarTransferencias();
      setModalDetalle(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fade" style={{ color: T.text, fontFamily: `${T.font}, sans-serif` }}>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: `${T.fontDisplay}, sans-serif` }}>
              Transferencias
            </h2>
            <div style={{ fontSize: 11, color: T.textMid, marginTop: 4 }}>
              {transferenciasFiltradas.length} transferencias
            </div>
          </div>
          <button onClick={abrirCrear} style={btnStyle}>
            + Nueva Transferencia
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
            <option value="en_transito">En transito</option>
            <option value="completada">Completada</option>
          </select>
          <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)} style={inputStyle}>
            <option value="todas">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.bg }}>
              {['Fecha', 'Origen -> Destino', 'Productos', 'Estado', 'Aprobacion', 'Acciones'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 10,
                    color: T.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontFamily: `${T.fontMono}, monospace`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: T.textMid }}>
                  Cargando transferencias...
                </td>
              </tr>
            )}
            {!loading && transferenciasFiltradas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: T.textMid }}>
                  No hay transferencias para los filtros seleccionados.
                </td>
              </tr>
            )}
            {!loading &&
              transferenciasFiltradas.map((t) => {
                const nItems = Array.isArray(t?.items) ? t.items.length : Number(t?.items_count || 0);
                return (
                  <tr key={t.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: T.textMid }}>
                      {t?.fecha_creacion ? new Date(t.fecha_creacion).toLocaleDateString('es-PE') : '-'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12 }}>
                      <span style={{ color: T.textMid }}>
                        {getSucursalNombre(t?.sucursal_origen_id, t?.sucursal_origen)}
                      </span>
                      <span style={{ color: T.textDim, margin: '0 6px' }}>-></span>
                      <span style={{ color: T.text }}>
                        {getSucursalNombre(t?.sucursal_destino_id, t?.sucursal_destino)}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: T.textMid }}>
                      {nItems} {nItems === 1 ? 'producto' : 'productos'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>{getBadgeEstado(t?.estado)}</td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: T.textMid }}>
                      {t?.aprobacion_requerida ? 'Manual' : 'Automatica'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {t?.estado === 'pendiente' && (
                          <>
                            <button
                              onClick={() => void aprobarTransferencia(t.id)}
                              disabled={procesando}
                              style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={async () => {
                                const motivo = window.prompt('Motivo de rechazo');
                                if (motivo === null) return;
                                if (!String(motivo).trim()) return alert('Debes ingresar un motivo.');
                                await rechazarTransferencia(t.id, String(motivo).trim());
                              }}
                              disabled={procesando}
                              style={{
                                ...btnGhost,
                                color: '#ef4444',
                                borderColor: '#ef444455',
                                padding: '4px 8px',
                                fontSize: 11,
                              }}
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => abrirDetalle(t)}
                          style={{ ...btnGhost, color: '#38bdf8', borderColor: '#38bdf855', padding: '4px 8px', fontSize: 11 }}
                        >
                          Ver detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modalCrear && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => !creando && setModalCrear(false)}
        >
          <form
            onSubmit={crearTransferencia}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(920px, 96vw)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: T.surface,
              border: `1px solid ${T.border2}`,
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nueva Transferencia</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 11, color: T.textMid, display: 'flex', flexDirection: 'column', gap: 6 }}>
                Sucursal origen
                <select
                  required
                  value={form.sucursal_origen_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, sucursal_origen_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Selecciona sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, color: T.textMid, display: 'flex', flexDirection: 'column', gap: 6 }}>
                Sucursal destino
                <select
                  required
                  value={form.sucursal_destino_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, sucursal_destino_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Selecciona sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 10,
                background: T.surface2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Aprobacion requerida</div>
                <div style={{ fontSize: 10, color: T.textMid }}>Requiere aprobacion manual</div>
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, aprobacion_requerida: !prev.aprobacion_requerida }))}
                style={{
                  width: 54,
                  height: 28,
                  borderRadius: 20,
                  border: `1px solid ${form.aprobacion_requerida ? `${T.accent}66` : T.border2}`,
                  background: form.aprobacion_requerida ? T.accentDim : T.bg,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: form.aprobacion_requerida ? 27 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: form.aprobacion_requerida ? T.accent : T.textDim,
                  }}
                />
              </button>
            </div>

            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 10,
                background: T.surface2,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 12, color: T.text }}>Productos a transferir</strong>
                <button type="button" onClick={onAddItem} style={{ ...btnStyle, padding: '6px 10px' }}>
                  Agregar producto
                </button>
              </div>

              {items.map((it, index) => {
                const idsTomados = new Set(
                  items.filter((_, i) => i !== index).map((x) => String(x.producto_id || '')),
                );
                const stock = getStockDisponible(it.producto_id, form.sucursal_origen_id);
                return (
                  <div
                    key={`it-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 130px auto',
                      gap: 8,
                      alignItems: 'start',
                      borderTop: index ? `1px solid ${T.border}` : 'none',
                      paddingTop: index ? 10 : 0,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <select
                        value={it.producto_id}
                        onChange={(e) => onChangeItem(index, 'producto_id', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Selecciona producto</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id} disabled={idsTomados.has(String(p.id))}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: 10, color: T.textMid }}>Stock disponible en origen: {stock}</span>
                    </div>

                    <input
                      type="number"
                      min={1}
                      value={it.cantidad_enviada}
                      onChange={(e) => onChangeItem(index, 'cantidad_enviada', e.target.value)}
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      disabled={items.length <= 1}
                      style={{
                        ...btnGhost,
                        height: 37,
                        color: items.length <= 1 ? T.textDim : '#ef4444',
                        borderColor: items.length <= 1 ? T.border2 : '#ef444455',
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>

            <label style={{ fontSize: 11, color: T.textMid, display: 'flex', flexDirection: 'column', gap: 6 }}>
              Notas
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </label>

            {errorCrear && (
              <div
                style={{
                  border: '1px solid #ef444455',
                  background: '#ef444418',
                  borderRadius: 8,
                  color: '#ef4444',
                  fontSize: 11,
                  padding: '8px 10px',
                }}
              >
                {errorCrear}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setModalCrear(false)} style={btnGhost} disabled={creando}>
                Cancelar
              </button>
              <button type="submit" style={btnStyle} disabled={creando}>
                {creando ? 'Creando...' : 'Crear Transferencia'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalDetalle && transferenciaSeleccionada && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => !procesando && setModalDetalle(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(900px, 96vw)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: T.surface,
              border: `1px solid ${T.border2}`,
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Detalle de Transferencia</h3>
            <div style={{ fontSize: 12, color: T.text }}>
              <div>
                <span style={{ color: T.textMid }}>ID:</span> {String(transferenciaSeleccionada.id || '').slice(0, 8)}
              </div>
              <div>
                <span style={{ color: T.textMid }}>Fecha:</span>{' '}
                {transferenciaSeleccionada?.fecha_creacion
                  ? new Date(transferenciaSeleccionada.fecha_creacion).toLocaleString('es-PE')
                  : '-'}
              </div>
              <div>
                <span style={{ color: T.textMid }}>Ruta:</span>{' '}
                {getSucursalNombre(
                  transferenciaSeleccionada?.sucursal_origen_id,
                  transferenciaSeleccionada?.sucursal_origen,
                )}{' '}
                ->{' '}
                {getSucursalNombre(
                  transferenciaSeleccionada?.sucursal_destino_id,
                  transferenciaSeleccionada?.sucursal_destino,
                )}
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: T.textMid }}>Estado:</span> {getBadgeEstado(transferenciaSeleccionada.estado)}
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: T.textMid }}>Notas:</span> {transferenciaSeleccionada?.notas || 'Sin notas'}
              </div>
            </div>

            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', background: T.surface2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {['Producto', 'Cantidad enviada', 'Cantidad recibida'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: 10,
                          color: T.textDim,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontFamily: `${T.fontMono}, monospace`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(transferenciaSeleccionada?.items || []).map((it: any, i: number) => (
                    <tr key={it?.id || i} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: T.text }}>
                        {it?.producto?.nombre || productosById[String(it?.producto_id || '')]?.nombre || it?.producto_id}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: T.textMid }}>
                        {Number(it?.cantidad_enviada || 0)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: T.textMid }}>
                        {Number(it?.cantidad_recibida || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {transferenciaSeleccionada?.estado === 'pendiente' && (
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, background: T.surface2 }}>
                <label style={{ fontSize: 11, color: T.textMid, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  Motivo de rechazo
                  <textarea
                    rows={2}
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => void aprobarTransferencia(transferenciaSeleccionada.id)}
                    disabled={procesando}
                    style={btnStyle}
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => {
                      const motivo = String(motivoRechazo || '').trim();
                      if (!motivo) return alert('Debes ingresar un motivo de rechazo.');
                      void rechazarTransferencia(transferenciaSeleccionada.id, motivo);
                    }}
                    disabled={procesando}
                    style={{ ...btnGhost, color: '#ef4444', borderColor: '#ef444455' }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalDetalle(false)} disabled={procesando} style={btnGhost}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
