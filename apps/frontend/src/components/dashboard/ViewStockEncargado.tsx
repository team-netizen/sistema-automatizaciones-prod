// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
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

function statusBadge(cantidad: number, minimo: number) {
  if (cantidad <= 0) return { label: 'Sin stock', color: T.danger, bg: '#fee2e2' };
  if (cantidad < minimo) return { label: 'Bajo', color: T.warning, bg: '#fef3c7' };
  return { label: 'OK', color: T.accent, bg: T.accentLight };
}

function toRows(payload: any, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

export const ViewStockEncargado = ({ usuario }: { usuario?: any }) => {
  const sucursalId = String(usuario?.sucursal_id || '');

  const [stockRows, setStockRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada');
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await operacionesService.getStockPorSucursal?.(sucursalId);
        setStockRows(toRows(data, ['stock', 'data', 'items']));
      } finally {
        setLoading(false);
      }
    };

    if (sucursalId) {
      void load();
    } else {
      setLoading(false);
    }
  }, [sucursalId]);

  const productos = useMemo(() => {
    return stockRows
      .filter((row: any) => String(row?.sucursal_id || '') === sucursalId)
      .map((row: any) => ({
        producto_id: row?.producto_id,
        sku: row?.producto_sku || row?.sku || row?.producto?.sku || '-',
        nombre: row?.producto_nombre || row?.nombre || row?.producto?.nombre || 'Producto',
        cantidad: Number(row?.cantidad || 0),
        stock_minimo: Number(row?.stock_minimo ?? row?.producto?.stock_minimo ?? 0),
      }))
      .filter((row: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return row.nombre.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
  }, [search, stockRows, sucursalId]);

  const stockBajo = productos.filter((row: any) => row.stock_minimo > 0 && row.cantidad < row.stock_minimo).length;
  const sinStock = productos.filter((row: any) => row.cantidad <= 0).length;

  const openAdjust = (row: any) => {
    setSelected(row);
    setTipo('entrada');
    setCantidad(0);
    setMotivo('Ajuste manual de stock');
    setError('');
    setModalOpen(true);
  };

  const confirmarAjuste = async () => {
    if (!selected?.producto_id) {
      setError('Producto invalido.');
      return;
    }

    if (cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }

    if (tipo === 'salida' && cantidad > Number(selected?.cantidad || 0)) {
      setError(`La salida no puede superar el stock actual (${selected?.cantidad || 0}).`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await operacionesService.ajustarStock?.({
        producto_id: selected.producto_id,
        sucursal_id: sucursalId,
        tipo,
        cantidad,
        motivo,
      });

      setStockRows((prev) =>
        prev.map((row: any) => {
          if (
            String(row?.sucursal_id || '') !== sucursalId ||
            String(row?.producto_id || '') !== String(selected?.producto_id || '')
          ) {
            return row;
          }

          const actual = Number(row?.cantidad || 0);
          const next = tipo === 'entrada' ? actual + cantidad : Math.max(0, actual - cantidad);
          return { ...row, cantidad: next };
        }),
      );

      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'No se pudo ajustar el stock.');
    } finally {
      setSaving(false);
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
            <h2 style={{ fontSize: 24, margin: 0 }}>Stock de sucursal</h2>
            <div style={{ color: T.textMid, fontSize: 13, marginTop: 6 }}>
              Control de stock para la sucursal asignada.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 999,
                color: T.warning,
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 12px',
              }}
            >
              {stockBajo} bajo
            </div>
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 999,
                color: T.danger,
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 12px',
              }}
            >
              {sinStock} sin stock
            </div>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por SKU o producto"
          style={{ ...inputStyle, maxWidth: 320, width: '100%' }}
        />
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['SKU', 'Producto', 'Stock actual', 'Mínimo', 'Estado', 'Acciones'].map((label) => (
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
                    Cargando stock...
                  </td>
                </tr>
              )}

              {!loading && productos.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: T.textMid, padding: 28, textAlign: 'center' }}>
                    No hay productos para mostrar en esta sucursal.
                  </td>
                </tr>
              )}

              {!loading &&
                productos.map((row: any) => {
                  const badge = statusBadge(row.cantidad, row.stock_minimo);
                  return (
                    <tr
                      key={row.producto_id}
                      style={{
                        borderTop: `1px solid ${T.border}`,
                      }}
                    >
                      <td style={{ color: T.textMid, fontFamily: 'monospace', padding: '14px 16px' }}>{row.sku}</td>
                      <td style={{ color: T.text, fontWeight: 600, padding: '14px 16px' }}>{row.nombre}</td>
                      <td style={{ color: T.text, padding: '14px 16px' }}>{row.cantidad}</td>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>{row.stock_minimo}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: badge.bg,
                            borderRadius: 999,
                            color: badge.color,
                            display: 'inline-flex',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 10px',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={() => openAdjust(row)} style={buttonGhost} type="button">
                          Ajustar stock
                        </button>
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
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...cardStyle,
              maxWidth: 460,
              padding: 24,
              width: '100%',
            }}
          >
            <div style={{ color: T.text, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
              Ajustar stock
            </div>
            <div style={{ color: T.textMid, fontSize: 13, marginBottom: 16 }}>
              {selected?.nombre} · stock actual {selected?.cantidad || 0}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setTipo('entrada')}
                style={tipo === 'entrada' ? buttonPrimary : buttonGhost}
                type="button"
              >
                Entrada
              </button>
              <button
                onClick={() => setTipo('salida')}
                style={tipo === 'salida' ? buttonPrimary : buttonGhost}
                type="button"
              >
                Salida
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <input
                min={1}
                onChange={(e) => setCantidad(Number(e.target.value || 0))}
                placeholder="Cantidad"
                style={inputStyle}
                type="number"
                value={cantidad || ''}
              />

              <textarea
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo del ajuste"
                style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                value={motivo}
              />

              {error && <div style={{ color: T.danger, fontSize: 12 }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setModalOpen(false)} style={buttonGhost} type="button">
                Cancelar
              </button>
              <button onClick={() => void confirmarAjuste()} style={buttonPrimary} type="button">
                {saving ? 'Guardando...' : 'Confirmar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
