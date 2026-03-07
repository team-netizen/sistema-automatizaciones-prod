// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const T = {
  bg: '#f5f6fa',
  surface: '#ffffff',
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

const buttonStyle = {
  background: T.accent,
  border: 'none',
  borderRadius: T.radiusSm,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  padding: '10px 14px',
};

function exportarCSV(datos: any[], nombre: string) {
  if (!datos || datos.length === 0) return;

  const headers = Object.keys(datos[0]).join(',');
  const rows = datos
    .map((row) =>
      Object.values(row)
        .map((value) => {
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value;
        })
        .join(','),
    )
    .join('\n');

  const csv = `${headers}\n${rows}`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getRange(periodo: string) {
  const hoy = new Date();
  const fin = hoy.toISOString().split('T')[0];

  if (periodo === 'hoy') return { inicio: fin, fin };
  if (periodo === 'semana') {
    const base = new Date();
    const day = base.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const lunes = new Date(base.setDate(base.getDate() + offset)).toISOString().split('T')[0];
    return { inicio: lunes, fin };
  }

  return {
    inicio: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
    fin,
  };
}

function tipoBadge(tipo: string) {
  const text = String(tipo || '').toLowerCase();
  if (text.includes('entrada')) return { label: 'Entrada', bg: T.accentLight, color: T.accent };
  if (text.includes('salida')) return { label: 'Salida', bg: '#fee2e2', color: T.danger };
  if (text.includes('transferencia')) return { label: 'Transferencia', bg: '#dbeafe', color: T.info };
  return { label: 'Ajuste', bg: '#fef3c7', color: T.warning };
}

function normalizeRows(payload: any) {
  const rows = Array.isArray(payload) ? payload : payload?.data || payload?.items || [];
  return rows.map((row: any) => ({
    fecha: row?.fecha_creacion || row?.created_at || null,
    producto: row?.producto?.nombre || row?.producto_nombre || 'Producto',
    sku: row?.producto?.sku || row?.sku || '-',
    tipo: row?.tipo || '-',
    cantidad: Number(row?.cantidad || 0),
    referencia: row?.referencia_tipo || '-',
    usuario: row?.usuario?.nombre || row?.creado_por_nombre || '-',
  }));
}

export const ViewMovimientos = ({ usuario }: { usuario?: any }) => {
  const sucursalId = String(usuario?.sucursal_id || '');
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('mes');
  const [tipo, setTipo] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const range = getRange(periodo);
        const data = await operacionesService.getMovimientos?.({
          sucursal_id: sucursalId,
          inicio: range.inicio,
          fin: range.fin,
          tipo,
        });
        setRows(normalizeRows(data));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [periodo, sucursalId, tipo]);

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        fecha: row.fecha ? new Date(row.fecha).toISOString() : '',
        producto: row.producto,
        sku: row.sku,
        tipo: row.tipo,
        cantidad: row.cantidad,
        referencia: row.referencia,
        usuario: row.usuario,
      })),
    [rows],
  );

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
            <h2 style={{ fontSize: 24, margin: 0 }}>Movimientos de stock</h2>
            <div style={{ color: T.textMid, fontSize: 13, marginTop: 6 }}>
              Historial filtrado de la sucursal asignada.
            </div>
          </div>

          <button onClick={() => exportarCSV(exportRows, 'movimientos_stock')} style={buttonStyle} type="button">
            Exportar CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select onChange={(e) => setPeriodo(e.target.value as any)} style={inputStyle} value={periodo}>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
          </select>

          <select onChange={(e) => setTipo(e.target.value)} style={inputStyle} value={tipo}>
            <option value="todos">Todos los tipos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="transferencia_entrada">Transferencia entrada</option>
            <option value="transferencia_salida">Transferencia salida</option>
            <option value="ajuste_entrada">Ajuste entrada</option>
            <option value="ajuste_salida">Ajuste salida</option>
          </select>
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Referencia', 'Usuario'].map((label) => (
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
                    Cargando movimientos...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: T.textMid, padding: 28, textAlign: 'center' }}>
                    No hay movimientos para los filtros seleccionados.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row, index) => {
                  const tipoInfo = tipoBadge(row.tipo);
                  return (
                    <tr key={`${row.fecha}-${row.sku}-${index}`} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>
                        {row.fecha ? new Date(row.fecha).toLocaleString('es-PE') : '-'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: T.text, fontWeight: 600 }}>{row.producto}</div>
                        <div style={{ color: T.textLight, fontSize: 12 }}>{row.sku}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            background: tipoInfo.bg,
                            borderRadius: 999,
                            color: tipoInfo.color,
                            display: 'inline-flex',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 10px',
                          }}
                        >
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td style={{ color: row.cantidad < 0 ? T.danger : T.accent, fontWeight: 700, padding: '14px 16px' }}>
                        {row.cantidad}
                      </td>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>{row.referencia}</td>
                      <td style={{ color: T.textMid, padding: '14px 16px' }}>{row.usuario}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
