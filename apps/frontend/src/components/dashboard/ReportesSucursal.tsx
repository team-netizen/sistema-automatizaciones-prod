import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type ReportTab = 'stock' | 'movimientos' | 'transferencias' | 'pedidos';
type PresetKey = 'today' | 'last7' | 'last30' | 'month';

export interface ReportesSucursalProps {
  sucursalId: string;
  sucursalNombre: string;
  empresaId: string;
  token: string;
  apiBase: string;
}

interface StockRow {
  producto_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  stock_minimo: number;
  estado: 'ok' | 'bajo' | 'sin_stock';
}

interface MovimientoRow {
  id: string;
  created_at: string;
  tipo: string;
  producto_nombre: string;
  sku: string;
  cantidad_anterior: number;
  cantidad_nueva: number;
  diferencia: number;
  motivo: string;
  usuario_nombre: string;
}

interface TransferenciaRow {
  id: string;
  created_at: string;
  direccion: 'enviada' | 'recibida';
  sucursal_origen: string;
  sucursal_destino: string;
  estado: string;
  productos_count: number;
  total_unidades: number;
}

interface PedidoRow {
  id: string;
  created_at: string;
  numero_pedido: string;
  canal: string;
  estado: string;
  total: number;
  items_count: number;
}

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}

const T = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  accent: '#2d6a4f',
  accentLight: '#d1fae5',
  accentMid: '#52b788',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  border: '#e8ecf0',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  warning: '#d97706',
  warningLight: '#fef3c7',
  info: '#1d4ed8',
  infoLight: '#dbeafe',
  violet: '#7c3aed',
  violetLight: '#ede9fe',
  shadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  radius: '18px',
  radiusSm: '10px',
};

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'stock', label: '📦 Stock actual' },
  { id: 'movimientos', label: '🔄 Movimientos' },
  { id: 'transferencias', label: '🚚 Transferencias' },
  { id: 'pedidos', label: '🛒 Pedidos' },
];

const PRESETS: Array<{ id: PresetKey; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'last7', label: '7 dias' },
  { id: 'last30', label: '30 dias' },
  { id: 'month', label: 'Este mes' },
];

function getMonthStart(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().split('T')[0];
}

function getPresetRange(preset: PresetKey): { desde: string; hasta: string } {
  const today = new Date();
  const hasta = today.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { desde: hasta, hasta };
    case 'last7':
      return { desde: addDays(today, -6), hasta };
    case 'last30':
      return { desde: addDays(today, -29), hasta };
    case 'month':
    default:
      return { desde: getMonthStart(), hasta };
  }
}

function normalizeApiBase(apiBase: string): string {
  return apiBase.replace(/\/+$/, '');
}

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function slugify(value: string): string {
  return String(value || 'sucursal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const content = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getBadgeTone(status: string): { background: string; color: string } {
  const key = String(status || '').toLowerCase();
  const map: Record<string, { background: string; color: string }> = {
    ok: { background: T.accentLight, color: T.accent },
    completada: { background: T.accentLight, color: T.accent },
    entregado: { background: T.accentLight, color: T.accent },
    bajo: { background: T.warningLight, color: T.warning },
    pendiente: { background: T.warningLight, color: T.warning },
    sin_stock: { background: T.dangerLight, color: T.danger },
    rechazada: { background: T.dangerLight, color: T.danger },
    cancelado: { background: T.dangerLight, color: T.danger },
    aprobada: { background: T.infoLight, color: T.info },
    procesando: { background: T.infoLight, color: T.info },
    ajuste_manual: { background: T.violetLight, color: T.violet },
    transferencia_entrada: { background: T.accentLight, color: T.accent },
    transferencia_salida: { background: T.warningLight, color: T.warning },
    enviada: { background: T.warningLight, color: T.warning },
    recibida: { background: T.accentLight, color: T.accent },
  };

  return map[key] || { background: '#eef2f7', color: T.textMuted };
}

function Badge({ label }: { label: string }) {
  const tone = getBadgeTone(label);
  return (
    <span
      style={{
        alignItems: 'center',
        background: tone.background,
        borderRadius: 999,
        color: tone.color,
        display: 'inline-flex',
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        textTransform: 'capitalize',
      }}
    >
      {String(label || '-').replace(/_/g, ' ')}
    </span>
  );
}

function Spinner() {
  return (
    <div
      style={{
        animation: 'reportes-spin 1s linear infinite',
        border: `3px solid ${T.border}`,
        borderRadius: '50%',
        borderTopColor: T.accent,
        height: 26,
        width: 26,
      }}
    />
  );
}

function EmptyState({ tab }: { tab: ReportTab }) {
  const copy: Record<ReportTab, string> = {
    stock: 'No hay productos de stock para esta sucursal en el rango seleccionado.',
    movimientos: 'No hay movimientos registrados para los filtros aplicados.',
    transferencias: 'No hay transferencias relacionadas con esta sucursal en ese periodo.',
    pedidos: 'No hay pedidos de la sucursal en el rango seleccionado.',
  };

  return (
    <div
      style={{
        alignItems: 'center',
        color: T.textMuted,
        display: 'grid',
        justifyItems: 'center',
        padding: '44px 20px',
        rowGap: 8,
      }}
    >
      <div style={{ fontSize: 34 }}>📭</div>
      <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>Sin resultados</div>
      <div style={{ fontSize: 13, maxWidth: 520, textAlign: 'center' }}>{copy[tab]}</div>
    </div>
  );
}

export default function ReportesSucursal({
  sucursalId,
  sucursalNombre,
  empresaId,
  token,
  apiBase,
}: ReportesSucursalProps) {
  const initialRange = getPresetRange('month');
  const [tab, setTab] = useState<ReportTab>('stock');
  const [desde, setDesde] = useState(initialRange.desde);
  const [hasta, setHasta] = useState(initialRange.hasta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [movimientoRows, setMovimientoRows] = useState<MovimientoRow[]>([]);
  const [transferenciaRows, setTransferenciaRows] = useState<TransferenciaRow[]>([]);
  const [pedidoRows, setPedidoRows] = useState<PedidoRow[]>([]);

  const activePreset = useMemo(() => {
    const preset = PRESETS.find((item) => {
      const range = getPresetRange(item.id);
      return range.desde === desde && range.hasta === hasta;
    });
    return preset?.id ?? null;
  }, [desde, hasta]);

  useEffect(() => {
    const fetchReport = async () => {
      if (!token) {
        setError('No se encontro un token de sesion valido.');
        return;
      }

      if (desde > hasta) {
        setError('La fecha de inicio no puede ser mayor que la fecha fin.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          sucursalId,
          empresaId,
          desde,
          hasta,
        });

        const base = `${normalizeApiBase(apiBase)}/api/operaciones/reportes`;
        const endpointMap: Record<ReportTab, string> = {
          stock: `${base}/stock-sucursal?sucursalId=${encodeURIComponent(sucursalId)}&empresaId=${encodeURIComponent(empresaId)}`,
          movimientos: `${base}/movimientos-sucursal?${params.toString()}`,
          transferencias: `${base}/transferencias-sucursal?${params.toString()}`,
          pedidos: `${base}/pedidos-sucursal?${params.toString()}`,
        };

        const response = await fetch(endpointMap[tab], {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let message = 'No se pudo cargar el reporte.';
          try {
            const payload = await response.json();
            message = payload?.message || message;
          } catch {
            // noop
          }
          throw new Error(message);
        }

        const payload = await response.json();

        if (tab === 'stock') setStockRows(Array.isArray(payload) ? payload : []);
        if (tab === 'movimientos') setMovimientoRows(Array.isArray(payload) ? payload : []);
        if (tab === 'transferencias') setTransferenciaRows(Array.isArray(payload) ? payload : []);
        if (tab === 'pedidos') setPedidoRows(Array.isArray(payload) ? payload : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error de red al cargar el reporte.');
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [apiBase, empresaId, desde, hasta, sucursalId, tab, token]);

  const kpis = useMemo<KpiCard[]>(() => {
    if (tab === 'stock') {
      const total = stockRows.length;
      const ok = stockRows.filter((row) => row.estado === 'ok').length;
      const bajo = stockRows.filter((row) => row.estado === 'bajo').length;
      const sinStock = stockRows.filter((row) => row.estado === 'sin_stock').length;
      return [
        { label: 'Total productos', value: total.toLocaleString(), hint: 'Items con registro de stock' },
        { label: 'Con stock OK', value: ok.toLocaleString(), hint: 'Sobre el minimo', tone: T.accent },
        { label: 'Stock bajo', value: bajo.toLocaleString(), hint: 'Requieren reposicion', tone: T.warning },
        { label: 'Sin stock', value: sinStock.toLocaleString(), hint: 'Sin unidades disponibles', tone: T.danger },
      ];
    }

    if (tab === 'movimientos') {
      const total = movimientoRows.length;
      const ajustes = movimientoRows.filter((row) => String(row.tipo).includes('ajuste')).length;
      const entradas = movimientoRows.filter((row) => row.diferencia > 0).length;
      const salidas = movimientoRows.filter((row) => row.diferencia < 0).length;
      return [
        { label: 'Total', value: total.toLocaleString(), hint: 'Movimientos en el periodo' },
        { label: 'Ajustes manuales', value: ajustes.toLocaleString(), hint: 'Cambios manuales', tone: T.violet },
        { label: 'Entradas', value: entradas.toLocaleString(), hint: 'Incrementos de stock', tone: T.accent },
        { label: 'Salidas', value: salidas.toLocaleString(), hint: 'Reducciones de stock', tone: T.warning },
      ];
    }

    if (tab === 'transferencias') {
      const total = transferenciaRows.length;
      const enviadas = transferenciaRows.filter((row) => row.direccion === 'enviada').length;
      const recibidas = transferenciaRows.filter((row) => row.direccion === 'recibida').length;
      const pendientes = transferenciaRows.filter((row) => row.estado === 'pendiente').length;
      return [
        { label: 'Total', value: total.toLocaleString(), hint: 'Transferencias del periodo' },
        { label: 'Enviadas', value: enviadas.toLocaleString(), hint: 'Salidas desde la sucursal', tone: T.warning },
        { label: 'Recibidas', value: recibidas.toLocaleString(), hint: 'Ingresos a la sucursal', tone: T.accent },
        { label: 'Pendientes', value: pendientes.toLocaleString(), hint: 'Aun sin completar', tone: T.warning },
      ];
    }

    const total = pedidoRows.length;
    const entregados = pedidoRows.filter((row) => String(row.estado).toLowerCase() === 'entregado').length;
    const cancelados = pedidoRows.filter((row) =>
      ['cancelado', 'rechazado'].includes(String(row.estado).toLowerCase()),
    ).length;
    const ingresos = pedidoRows
      .filter((row) => !['cancelado', 'rechazado'].includes(String(row.estado).toLowerCase()))
      .reduce((sum, row) => sum + Number(row.total || 0), 0);

    return [
      { label: 'Total', value: total.toLocaleString(), hint: 'Pedidos de la sucursal' },
      { label: 'Entregados', value: entregados.toLocaleString(), hint: 'Pedidos completados', tone: T.accent },
      { label: 'Ingresos', value: formatCurrency(ingresos), hint: 'Solo pedidos validos', tone: T.info },
      { label: 'Cancelados', value: cancelados.toLocaleString(), hint: 'No concretados', tone: T.danger },
    ];
  }, [movimientoRows, pedidoRows, stockRows, tab, transferenciaRows]);

  const currentRowsCount = tab === 'stock'
    ? stockRows.length
    : tab === 'movimientos'
      ? movimientoRows.length
      : tab === 'transferencias'
        ? transferenciaRows.length
        : pedidoRows.length;

  const exportCsv = () => {
    const safeSucursal = slugify(sucursalNombre || 'sucursal');
    const filename = `${tab}_${safeSucursal}_${desde}_${hasta}.csv`;

    if (tab === 'stock') {
      downloadCsv(
        filename,
        ['SKU', 'Producto', 'Cantidad', 'Minimo', 'Estado'],
        stockRows.map((row) => [row.sku, row.nombre, row.cantidad, row.stock_minimo, row.estado]),
      );
      return;
    }

    if (tab === 'movimientos') {
      downloadCsv(
        filename,
        ['Fecha', 'Tipo', 'SKU', 'Producto', 'Cambio', 'Stock resultante', 'Motivo', 'Responsable'],
        movimientoRows.map((row) => [
          row.created_at,
          row.tipo,
          row.sku,
          row.producto_nombre,
          row.diferencia,
          row.cantidad_nueva,
          row.motivo,
          row.usuario_nombre,
        ]),
      );
      return;
    }

    if (tab === 'transferencias') {
      downloadCsv(
        filename,
        ['Fecha', 'Direccion', 'Origen', 'Destino', 'Unidades', 'Estado'],
        transferenciaRows.map((row) => [
          row.created_at,
          row.direccion,
          row.sucursal_origen,
          row.sucursal_destino,
          row.total_unidades,
          row.estado,
        ]),
      );
      return;
    }

    downloadCsv(
      filename,
      ['Fecha', 'Numero pedido', 'Canal', 'Items', 'Total', 'Estado'],
      pedidoRows.map((row) => [
        row.created_at,
        row.numero_pedido,
        row.canal,
        row.items_count,
        row.total,
        row.estado,
      ]),
    );
  };

  return (
    <div
      style={{
        color: T.text,
        display: 'grid',
        gap: 16,
        fontFamily: "'DM Sans', 'Nunito', sans-serif",
      }}
    >
      <style>
        {`
          @keyframes reportes-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          display: 'grid',
          gap: 16,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 800 }}>Reportes de sucursal</div>
            <div style={{ color: T.textMuted, fontSize: 14, marginTop: 6 }}>
              Analiza stock, movimientos, transferencias y pedidos de {sucursalNombre}.
            </div>
          </div>

          <button
            disabled={currentRowsCount === 0}
            onClick={exportCsv}
            type="button"
            style={{
              background: currentRowsCount === 0 ? '#edf0f4' : T.accent,
              border: 'none',
              borderRadius: T.radiusSm,
              color: currentRowsCount === 0 ? T.textMuted : '#fff',
              cursor: currentRowsCount === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 800,
              padding: '11px 14px',
            }}
          >
            ↓ Exportar CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  const range = getPresetRange(preset.id);
                  setDesde(range.desde);
                  setHasta(range.hasta);
                }}
                type="button"
                style={{
                  background: active ? T.accentLight : T.bg,
                  border: `1px solid ${active ? '#b7e4c7' : T.border}`,
                  borderRadius: 999,
                  color: active ? T.accent : T.textMuted,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '9px 12px',
                }}
              >
                {preset.label}
              </button>
            );
          })}

          <input
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              color: T.text,
              fontSize: 13,
              padding: '9px 12px',
            }}
          />

          <input
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              color: T.text,
              fontSize: 13,
              padding: '9px 12px',
            }}
          />
        </div>

        <div
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            display: 'flex',
            gap: 8,
            padding: 6,
            flexWrap: 'wrap',
          }}
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
                style={{
                  background: active ? T.surface : 'transparent',
                  border: `1px solid ${active ? T.border : 'transparent'}`,
                  borderRadius: 999,
                  boxShadow: active ? '0 6px 20px rgba(15, 23, 42, 0.08)' : 'none',
                  color: active ? T.text : T.textMuted,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  padding: '10px 14px',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {kpis.map((card) => (
          <div
            key={card.label}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              boxShadow: T.shadow,
              display: 'grid',
              gap: 8,
              padding: '20px 22px',
            }}
          >
            <div style={{ color: T.textMuted, fontSize: 13, fontWeight: 700 }}>{card.label}</div>
            <div style={{ color: card.tone || T.text, fontSize: 30, fontWeight: 800 }}>{card.value}</div>
            <div style={{ color: T.textMuted, fontSize: 12 }}>{card.hint}</div>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: T.dangerLight,
            border: `1px solid ${T.danger}`,
            borderRadius: T.radiusSm,
            color: T.danger,
            fontSize: 13,
            fontWeight: 700,
            padding: '12px 14px',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div
            style={{
              alignItems: 'center',
              display: 'grid',
              justifyItems: 'center',
              minHeight: 260,
              rowGap: 12,
            }}
          >
            <Spinner />
            <div style={{ color: T.textMuted, fontSize: 13 }}>Cargando reporte...</div>
          </div>
        ) : currentRowsCount === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {tab === 'stock' && (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f9fbfc' }}>
                    {['SKU', 'Producto', 'Cantidad', 'Minimo', 'Estado'].map((label) => (
                      <th key={label} style={headerCellStyle}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr
                      key={row.producto_id}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#f5f6fa';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <td style={bodyCellStyle}>{row.sku}</td>
                      <td style={bodyCellStyleStrong}>{row.nombre}</td>
                      <td style={bodyCellStyle}>{row.cantidad}</td>
                      <td style={bodyCellStyle}>{row.stock_minimo}</td>
                      <td style={bodyCellStyle}>
                        <Badge label={row.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'movimientos' && (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f9fbfc' }}>
                    {['Fecha', 'Tipo', 'SKU', 'Producto', 'Cambio', 'Stock resultante', 'Motivo', 'Responsable'].map((label) => (
                      <th key={label} style={headerCellStyle}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientoRows.map((row) => (
                    <tr
                      key={row.id}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#f5f6fa';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <td style={bodyCellStyle}>{formatDate(row.created_at)}</td>
                      <td style={bodyCellStyle}>
                        <Badge label={row.tipo} />
                      </td>
                      <td style={bodyCellStyle}>{row.sku}</td>
                      <td style={bodyCellStyleStrong}>{row.producto_nombre}</td>
                      <td
                        style={{
                          ...bodyCellStyle,
                          color: row.diferencia >= 0 ? T.accent : T.danger,
                          fontWeight: 800,
                        }}
                      >
                        {row.diferencia >= 0 ? '+' : ''}
                        {row.diferencia}
                      </td>
                      <td style={bodyCellStyle}>{row.cantidad_nueva}</td>
                      <td style={bodyCellStyle}>{row.motivo}</td>
                      <td style={bodyCellStyle}>{row.usuario_nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'transferencias' && (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f9fbfc' }}>
                    {['Fecha', 'Direccion', 'Origen', 'Destino', 'Unidades', 'Estado'].map((label) => (
                      <th key={label} style={headerCellStyle}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transferenciaRows.map((row) => (
                    <tr
                      key={row.id}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#f5f6fa';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <td style={bodyCellStyle}>{formatDate(row.created_at)}</td>
                      <td style={bodyCellStyle}>
                        <Badge label={row.direccion === 'recibida' ? 'recibida' : 'enviada'} />
                      </td>
                      <td style={bodyCellStyle}>{row.sucursal_origen}</td>
                      <td style={bodyCellStyle}>{row.sucursal_destino}</td>
                      <td style={bodyCellStyle}>{row.total_unidades}</td>
                      <td style={bodyCellStyle}>
                        <Badge label={row.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'pedidos' && (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f9fbfc' }}>
                    {['Fecha', 'N° Pedido', 'Canal', 'Items', 'Total', 'Estado'].map((label) => (
                      <th key={label} style={headerCellStyle}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidoRows.map((row) => (
                    <tr
                      key={row.id}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = '#f5f6fa';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = '#ffffff';
                      }}
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <td style={bodyCellStyle}>{formatDate(row.created_at)}</td>
                      <td style={bodyCellStyleStrong}>{row.numero_pedido}</td>
                      <td style={bodyCellStyle}>{row.canal}</td>
                      <td style={bodyCellStyle}>{row.items_count}</td>
                      <td style={bodyCellStyle}>{formatCurrency(row.total)}</td>
                      <td style={bodyCellStyle}>
                        <Badge label={row.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const headerCellStyle: CSSProperties = {
  color: T.textMuted,
  fontSize: 12,
  fontWeight: 800,
  padding: '14px 16px',
  textAlign: 'left',
};

const bodyCellStyle: CSSProperties = {
  color: T.textMuted,
  fontSize: 13,
  padding: '14px 16px',
  verticalAlign: 'top',
};

const bodyCellStyleStrong: CSSProperties = {
  ...bodyCellStyle,
  color: T.text,
  fontWeight: 700,
};
