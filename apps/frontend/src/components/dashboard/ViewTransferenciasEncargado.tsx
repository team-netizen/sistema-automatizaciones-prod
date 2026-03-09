// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { API_URL, apiFetch } from '../../lib/api';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const T = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  surfaceHover: '#f9fafb',
  border: '#e8ecf0',
  accent: '#2d6a4f',
  accentLight: '#d8f3dc',
  accentMid: '#40916c',
  text: '#1a1a2e',
  textMid: '#6b7280',
  textLight: '#9ca3af',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  shadow: '0 2px 12px rgba(0,0,0,0.06)',
  radius: '16px',
  radiusSm: '8px',
};

const cardStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
};

const inputStyle = {
  background: '#fff',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  color: T.text,
  fontSize: 13,
  outline: 'none',
  padding: '10px 12px',
};

const buttonPrimary = {
  background: T.accent,
  border: 'none',
  borderRadius: T.radiusSm,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  padding: '10px 14px',
};

const buttonGhost = {
  background: '#fff',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  color: T.textMid,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  padding: '10px 14px',
};

function toRows(payload: any, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function badge(estado: string) {
  const map: Record<string, { bg: string; color: string }> = {
    pendiente: { bg: '#fef3c7', color: T.warning },
    aprobada: { bg: '#dbeafe', color: T.info },
    en_transito: { bg: '#dbeafe', color: T.info },
    completada: { bg: T.accentLight, color: T.accent },
    rechazada: { bg: '#fee2e2', color: T.danger },
  };
  const value = map[String(estado || '')] || { bg: '#f3f4f6', color: T.textMid };
  return (
    <span
      style={{
        background: value.bg,
        borderRadius: 999,
        color: value.color,
        display: 'inline-flex',
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        textTransform: 'capitalize',
      }}
    >
      {String(estado || '').replace('_', ' ')}
    </span>
  );
}

async function completarTransferenciaRequest(id: string) {
  const response = await apiFetch(`${API_URL}/operaciones/transferencias/${id}/completar`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    let message = 'Error al completar transferencia';
    try {
      const error = await response.json();
      if (error?.message) message = error.message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return response.json();
}

export const ViewTransferenciasEncargado = ({ usuario }: { usuario?: any }) => {
  const sucursalId = String(usuario?.sucursal_id || '');

  const [tab, setTab] = useState<'entrantes' | 'salientes' | 'todas'>('entrantes');
  const [loading, setLoading] = useState(true);
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    sucursal_destino_id: '',
    notas: '',
    aprobacion_requerida: true,
  });
  const [items, setItems] = useState([{ producto_id: '', cantidad_enviada: 1 }]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [transferenciasRes, sucursalesRes, productosRes] = await Promise.all([
          operacionesService.getTransferencias?.({ sucursal_id: sucursalId }),
          operacionesService.getSucursales?.(),
          operacionesService.getProductos?.(),
        ]);

        setTransferencias(toRows(transferenciasRes, ['transferencias', 'data', 'items']));
        setSucursales(toRows(sucursalesRes, ['sucursales', 'data', 'items']));
        setProductos(toRows(productosRes, ['productos', 'data', 'items']));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sucursalId]);

  const sucursalMap = useMemo(() => {
    const map = new Map<string, any>();
    sucursales.forEach((row: any) => {
      const id = String(row?.id || '');
      if (id) map.set(id, row);
    });
    return map;
  }, [sucursales]);

  const productosMap = useMemo(() => {
    const map = new Map<string, any>();
    productos.forEach((row: any) => {
      const id = String(row?.id || '');
      if (id) map.set(id, row);
    });
    return map;
  }, [productos]);

  const transferenciasFiltradas = useMemo(() => {
    return transferencias.filter((row: any) => {
      const esEntrante = String(row?.sucursal_destino_id || '') === sucursalId;
      const esSaliente = String(row?.sucursal_origen_id || '') === sucursalId;

      if (tab === 'entrantes') return esEntrante;
      if (tab === 'salientes') return esSaliente;
      return esEntrante || esSaliente;
    });
  }, [sucursalId, tab, transferencias]);

  const stockDisponible = (productoId: string) => {
    const producto = productosMap.get(String(productoId || ''));
    const rows = Array.isArray(producto?.stock_por_sucursal) ? producto.stock_por_sucursal : [];
    const actual = rows.find((row: any) => String(row?.sucursal_id || '') === sucursalId);
    return Number(actual?.cantidad || 0);
  };

  const resetForm = () => {
    setError('');
    setForm({
      sucursal_destino_id: '',
      notas: '',
      aprobacion_requerida: true,
    });
    setItems([{ producto_id: '', cantidad_enviada: 1 }]);
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, { producto_id: '', cantidad_enviada: 1 }]);
  const removeItem = (index: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateItem = (index: number, key: 'producto_id' | 'cantidad_enviada', value: any) => {
    setItems((prev) =>
      prev.map((row, i) =>
        i !== index
          ? row
          : key === 'cantidad_enviada'
            ? { ...row, cantidad_enviada: Number(value || 0) }
            : { ...row, producto_id: String(value || '') },
      ),
    );
  };

  const crearTransferencia = async (e: any) => {
    e.preventDefault();
    setError('');

    if (!form.sucursal_destino_id) {
      setError('Debes seleccionar una sucursal destino.');
      return;
    }

    if (form.sucursal_destino_id === sucursalId) {
      setError('La sucursal destino no puede ser la misma sucursal actual.');
      return;
    }

    const validItems = items.filter((row) => row.producto_id && Number(row.cantidad_enviada) > 0);
    if (validItems.length === 0) {
      setError('Debes agregar al menos un item valido.');
      return;
    }

    for (const row of validItems) {
      const disponible = stockDisponible(row.producto_id);
      if (Number(row.cantidad_enviada) > disponible) {
        const nombre = productosMap.get(String(row.producto_id || ''))?.nombre || 'producto';
        setError(`Stock insuficiente para ${nombre}. Disponible ${disponible}.`);
        return;
      }
    }

    setSaving(true);
    try {
      await operacionesService.crearTransferencia?.({
        sucursal_origen_id: sucursalId,
        sucursal_destino_id: form.sucursal_destino_id,
        notas: form.notas || undefined,
        aprobacion_requerida: form.aprobacion_requerida,
        items: validItems.map((row) => ({
          producto_id: row.producto_id,
          cantidad_enviada: Number(row.cantidad_enviada),
        })),
      });

      const response = await operacionesService.getTransferencias?.({ sucursal_id: sucursalId });
      setTransferencias(toRows(response, ['transferencias', 'data', 'items']));
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la transferencia.');
    } finally {
      setSaving(false);
    }
  };

  const completarRecepcion = async (id: string) => {
    setProcessingId(id);
    try {
      await completarTransferenciaRequest(id);
      const response = await operacionesService.getTransferencias?.({ sucursal_id: sucursalId });
      setTransferencias(toRows(response, ['transferencias', 'data', 'items']));
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div style={{ color: T.text, display: 'grid', gap: 16 }}>
      <div style={{ ...cardStyle, padding: 20 }}>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ fontSize: 24, margin: 0 }}>Transferencias</h2>
            <div style={{ color: T.textMid, fontSize: 13, marginTop: 6 }}>
              Gestiona entradas y salidas de tu sucursal.
            </div>
          </div>

          <button onClick={openModal} style={buttonPrimary} type="button">
            Nueva transferencia
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['entrantes', 'Entrantes'],
            ['salientes', 'Salientes'],
            ['todas', 'Todas'],
          ].map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                style={{
                  ...(active ? buttonPrimary : buttonGhost),
                  padding: '9px 14px',
                }}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Fecha', 'Tipo', 'Ruta', 'Productos', 'Estado', 'Acciones'].map((label) => (
                  <th
                    key={label}
                    style={{
                      color: T.textMid,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '14px 16px',
                      textAlign: 'left',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ color: T.textMid, padding: 28, textAlign: 'center' }}>
                    Cargando transferencias...
                  </td>
                </tr>
              )}

              {!loading && transferenciasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: T.textMid, padding: 28, textAlign: 'center' }}>
                    No hay transferencias para esta vista.
                  </td>
                </tr>
              )}

              {!loading &&
                transferenciasFiltradas.map((row: any) => {
                  const esEntrante = String(row?.sucursal_destino_id || '') === sucursalId;
                  const puedeCompletar =
                    esEntrante && String(row?.estado || '') === 'aprobada';
                  const itemsCount = Array.isArray(row?.items)
                    ? row.items.length
                    : Number(row?.items_count || row?.total_items || 0);

                  return (
                    <tr key={row?.id || `${row?.sucursal_origen_id}-${row?.sucursal_destino_id}`} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>
                        {row?.fecha_creacion
                          ? new Date(row.fecha_creacion).toLocaleDateString('es-PE')
                          : '-'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: esEntrante ? '#dbeafe' : '#ede9fe',
                            borderRadius: 999,
                            color: esEntrante ? T.info : '#7c3aed',
                            display: 'inline-flex',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 10px',
                          }}
                        >
                          {esEntrante ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td style={{ color: T.text, padding: '14px 16px' }}>
                        {sucursalMap.get(String(row?.sucursal_origen_id || ''))?.nombre || 'Origen'}
                        {' → '}
                        {sucursalMap.get(String(row?.sucursal_destino_id || ''))?.nombre || 'Destino'}
                      </td>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>
                        {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>{badge(row?.estado)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {puedeCompletar ? (
                          <button
                            onClick={() => void completarRecepcion(row.id)}
                            style={buttonPrimary}
                            type="button"
                          >
                            {processingId === row.id ? 'Confirmando...' : 'Confirmar recepción'}
                          </button>
                        ) : (
                          <span style={{ color: T.textLight, fontSize: 12 }}>
                            {esEntrante ? 'Esperando aprobación' : 'Sin acciones'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          onClick={() => !saving && setModalOpen(false)}
          style={{
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.32)',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            padding: 24,
            position: 'fixed',
            zIndex: 100,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={crearTransferencia}
            style={{
              ...cardStyle,
              display: 'grid',
              gap: 14,
              maxHeight: '90vh',
              maxWidth: 820,
              overflow: 'auto',
              padding: 24,
              width: '100%',
            }}
          >
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
                Nueva transferencia
              </div>
              <div style={{ color: T.textMid, fontSize: 13 }}>
                La sucursal origen queda fija a tu sucursal asignada.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <input disabled style={{ ...inputStyle, background: '#f9fafb' }} value={sucursalMap.get(sucursalId)?.nombre || 'Sucursal actual'} />

              <select
                onChange={(e) => setForm((prev) => ({ ...prev, sucursal_destino_id: e.target.value }))}
                style={inputStyle}
                value={form.sucursal_destino_id}
              >
                <option value="">Selecciona sucursal destino</option>
                {sucursales
                  .filter((row: any) => String(row?.id || '') !== sucursalId)
                  .map((row: any) => (
                    <option key={row.id} value={row.id}>
                      {row.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <textarea
              onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Notas"
              style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }}
              value={form.notas}
            />

            <label style={{ alignItems: 'center', color: T.textMid, display: 'flex', fontSize: 13, gap: 8 }}>
              <input
                checked={form.aprobacion_requerida}
                onChange={(e) => setForm((prev) => ({ ...prev, aprobacion_requerida: e.target.checked }))}
                type="checkbox"
              />
              Requiere aprobación administrativa
            </label>

            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((row, index) => (
                <div key={`${index}-${row.producto_id}`} style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 160px auto' }}>
                  <select
                    onChange={(e) => updateItem(index, 'producto_id', e.target.value)}
                    style={inputStyle}
                    value={row.producto_id}
                  >
                    <option value="">Selecciona producto</option>
                    {productos.map((producto: any) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre} · {producto.sku || '-'} · disp. {stockDisponible(producto.id)}
                      </option>
                    ))}
                  </select>

                  <input
                    min={1}
                    onChange={(e) => updateItem(index, 'cantidad_enviada', e.target.value)}
                    style={inputStyle}
                    type="number"
                    value={row.cantidad_enviada}
                  />

                  <button onClick={() => removeItem(index)} style={buttonGhost} type="button">
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div>
              <button onClick={addItem} style={buttonGhost} type="button">
                Agregar item
              </button>
            </div>

            {error && <div style={{ color: T.danger, fontSize: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} style={buttonGhost} type="button">
                Cancelar
              </button>
              <button style={buttonPrimary} type="submit">
                {saving ? 'Creando...' : 'Crear transferencia'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
