// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const T = {
  bg: '#07090b',
  surface: '#0b0f12',
  surface2: '#0f1419',
  border: '#151d24',
  border2: '#1c2830',
  accent: '#00e87b',
  textMid: '#4d6b58',
  text: '#e8f5ee',
  textDim: '#2a3f30',
  font: 'DM Sans',
  fontMono: 'DM Mono',
};

const COLORES = ['#00e87b', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];

const tabStyle = (active: boolean) => ({
  background: active ? `${T.accent}18` : T.surface2,
  border: `1px solid ${active ? `${T.accent}44` : T.border2}`,
  color: active ? T.accent : T.textMid,
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
});

const cardStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: 16,
};

const inputStyle = {
  background: T.surface2,
  border: `1px solid ${T.border2}`,
  color: T.text,
  borderRadius: 8,
  fontSize: 12,
  padding: '9px 11px',
  outline: 'none',
};

const btnExport = {
  background: `${T.accent}18`,
  border: `1px solid ${T.accent}44`,
  color: T.accent,
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  padding: '9px 12px',
  cursor: 'pointer',
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

function money(value: number) {
  return `S/ ${Number(value || 0).toLocaleString()}`;
}

function getPrevRange(inicio: string, fin: string) {
  const start = new Date(`${inicio}T00:00:00`);
  const end = new Date(`${fin}T00:00:00`);
  const diff = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (diff - 1));

  return {
    inicio: prevStart.toISOString().split('T')[0],
    fin: prevEnd.toISOString().split('T')[0],
  };
}

export const ViewReportes = ({ usuario }: { usuario?: any }) => {
  void usuario;

  const [reporteActivo, setReporteActivo] = useState<
    'ventas' | 'productos' | 'stock' | 'canales'
  >('ventas');
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'personalizado'>('mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [datosVentas, setDatosVentas] = useState<any>(null);
  const [datosProductos, setDatosProductos] = useState<any[]>([]);
  const [datosStock, setDatosStock] = useState<any[]>([]);
  const [datosCanales, setDatosCanales] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);

  const service = operacionesService as any;

  const getFechas = () => {
    const hoy = new Date();
    const fin = hoy.toISOString().split('T')[0];

    switch (periodo) {
      case 'hoy':
        return { inicio: fin, fin };
      case 'semana': {
        const base = new Date();
        const day = base.getDay();
        const offset = day === 0 ? -6 : 1 - day;
        const lunesStr = new Date(base.setDate(base.getDate() + offset)).toISOString().split('T')[0];
        return { inicio: lunesStr, fin };
      }
      case 'mes':
        return {
          inicio: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
          fin,
        };
      case 'personalizado':
        return { inicio: fechaInicio, fin: fechaFin };
      default:
        return { inicio: fin, fin };
    }
  };

  useEffect(() => {
    const cargar = async () => {
      const { inicio, fin } = getFechas();
      if (reporteActivo !== 'stock' && (!inicio || !fin)) return;

      setLoading(true);
      try {
        if (reporteActivo === 'ventas') {
          const ventas = await service.getReporteVentas?.(inicio, fin);
          const previoRango = getPrevRange(inicio, fin);
          const previo = await service
            .getReporteVentas?.(previoRango.inicio, previoRango.fin)
            .catch(() => null);
          const totalPrevio = Number(previo?.total || 0);
          const totalActual = Number(ventas?.total || 0);
          const variacion = totalPrevio > 0
            ? Math.round(((totalActual - totalPrevio) / totalPrevio) * 100)
            : totalActual > 0 ? 100 : 0;

          setDatosVentas({
            total: Number(ventas?.total || 0),
            totalPedidos: Number(ventas?.totalPedidos || 0),
            ticketPromedio: Number(ventas?.ticketPromedio || 0),
            porDia: Array.isArray(ventas?.porDia) ? ventas.porDia : [],
            variacion,
          });
        }

        if (reporteActivo === 'productos') {
          const productos = await service.getReporteProductos?.(inicio, fin);
          setDatosProductos(Array.isArray(productos) ? productos : []);
        }

        if (reporteActivo === 'canales') {
          const canales = await service.getReporteCanales?.(inicio, fin);
          setDatosCanales(Array.isArray(canales) ? canales : []);
        }

        if (reporteActivo === 'stock') {
          const stockPromise = service.getStock ? service.getStock() : service.getStockPorSucursal();
          const [stockRes, sucRes] = await Promise.all([
            stockPromise,
            service.getSucursales(),
          ]);
          setDatosStock(Array.isArray(stockRes) ? stockRes : stockRes?.stock || []);
          setSucursales(Array.isArray(sucRes) ? sucRes : sucRes?.sucursales || []);
        }
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [reporteActivo, periodo, fechaInicio, fechaFin]);

  const productosConStock = useMemo(() => {
    const map = new Map<string, any>();

    datosStock.forEach((item) => {
      const key = item.producto_id || item.producto?.id || item.sku || item.nombre;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          producto_id: item.producto_id ?? item.producto?.id ?? key,
          nombre: item.producto_nombre || item.nombre || item.producto?.nombre || 'Sin nombre',
          sku: item.producto_sku || item.sku || item.producto?.sku || '-',
          stock_minimo: Number(item.stock_minimo ?? item.producto?.stock_minimo ?? 0),
          sucursales: {},
          total: 0,
        });
      }

      const producto = map.get(key);
      const cantidad = Number(item.cantidad || 0);
      producto.sucursales[item.sucursal_id] = cantidad;
      producto.total += cantidad;
    });

    return Array.from(map.values());
  }, [datosStock]);

  const totalUnidades = productosConStock.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const productosBajoMinimo = productosConStock.filter((item) =>
    Object.values(item.sucursales).some((cantidad: any) => Number(cantidad || 0) < Number(item.stock_minimo || 0)),
  ).length;

  const exportarReporte = (tipo: 'ventas' | 'productos' | 'stock' | 'canales') => {
    if (tipo === 'ventas') exportarCSV(datosVentas?.porDia || [], 'reporte_ventas');
    if (tipo === 'productos') exportarCSV(datosProductos || [], 'reporte_productos');
    if (tipo === 'stock') exportarCSV(datosStock || [], 'reporte_stock');
    if (tipo === 'canales') exportarCSV(datosCanales || [], 'reporte_canales');
  };

  const productosChart = (datosProductos || []).slice(0, 10);

  return (
    <div style={{ color: T.text, fontFamily: `${T.font}, sans-serif` }}>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Reportes</h2>
            <div style={{ marginTop: 4, color: T.textMid, fontSize: 12 }}>
              Ventas, productos, stock actual y rendimiento por canal.
            </div>
          </div>

          <button type="button" style={btnExport} onClick={() => exportarReporte(reporteActivo)}>
            Exportar CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['ventas', 'Ventas'],
            ['productos', 'Productos'],
            ['stock', 'Stock'],
            ['canales', 'Canales'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              style={tabStyle(reporteActivo === id)}
              onClick={() => setReporteActivo(id as any)}
            >
              {label}
            </button>
          ))}
        </div>

        {reporteActivo !== 'stock' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['hoy', 'Hoy'],
              ['semana', 'Esta semana'],
              ['mes', 'Este mes'],
              ['personalizado', 'Personalizado'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={tabStyle(periodo === id)}
                onClick={() => setPeriodo(id as any)}
              >
                {label}
              </button>
            ))}

            {periodo === 'personalizado' && (
              <>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={inputStyle}
                />
              </>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ ...cardStyle, color: T.textMid, textAlign: 'center' }}>
          Cargando reporte...
        </div>
      )}

      {!loading && reporteActivo === 'ventas' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {[
              { label: 'Total ventas', value: money(datosVentas?.total || 0) },
              { label: 'Pedidos', value: Number(datosVentas?.totalPedidos || 0).toLocaleString() },
              { label: 'Ticket promedio', value: money(datosVentas?.ticketPromedio || 0) },
              {
                label: 'Vs periodo anterior',
                value: `${Number(datosVentas?.variacion || 0) > 0 ? '+' : ''}${Number(datosVentas?.variacion || 0)}%`,
              },
            ].map((item) => (
              <div key={item.label} style={cardStyle}>
                <div style={{ fontSize: 11, color: T.textMid, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ width: '100%', height: 320, minWidth: 0, overflow: 'hidden' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosVentas?.porDia || []}>
                  <CartesianGrid stroke={T.border2} strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" stroke={T.textMid} />
                  <YAxis stroke={T.textMid} />
                  <Tooltip
                    formatter={(value: any, name: string) => (
                      name === 'total' ? money(Number(value || 0)) : Number(value || 0)
                    )}
                    contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}` }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke={T.accent} strokeWidth={2} />
                  <Line type="monotone" dataKey="pedidos" stroke="#f59e0b" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: T.textMid, fontSize: 11 }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>N pedidos</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Total S/</th>
                </tr>
              </thead>
              <tbody>
                {(datosVentas?.porDia || []).map((row: any) => (
                  <tr key={row.fecha} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '10px 8px' }}>{row.fecha}</td>
                    <td style={{ padding: '10px 8px' }}>{row.pedidos}</td>
                    <td style={{ padding: '10px 8px' }}>{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && reporteActivo === 'productos' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={cardStyle}>
            {productosChart.length > 0 ? (
              <div style={{ width: '100%', height: 400, minWidth: 0, overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={productosChart} margin={{ left: 24 }}>
                    <CartesianGrid stroke={T.border2} strokeDasharray="3 3" />
                    <XAxis type="number" stroke={T.textMid} />
                    <YAxis type="category" dataKey="nombre" width={220} stroke={T.textMid} />
                    <Tooltip
                      formatter={(value: any, name: string) => (
                        name === 'total' ? money(Number(value || 0)) : Number(value || 0)
                      )}
                      contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}` }}
                    />
                    <Bar dataKey="cantidad" fill={T.accent} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                style={{
                  height: 400,
                  display: 'grid',
                  placeItems: 'center',
                  color: T.textMid,
                  fontSize: 13,
                }}
              >
                No hay productos vendidos en el periodo seleccionado.
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: T.textMid, fontSize: 11 }}>
                  {['#', 'Producto', 'SKU', 'Cantidad', 'Total S/'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: '10px 8px' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(datosProductos || []).length > 0 ? (
                  (datosProductos || []).map((row: any) => (
                    <tr key={`${row.rank}-${row.sku}`} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 8px' }}>{row.rank}</td>
                      <td style={{ padding: '10px 8px' }}>{row.nombre}</td>
                      <td style={{ padding: '10px 8px', fontFamily: `${T.fontMono}, monospace` }}>{row.sku}</td>
                      <td style={{ padding: '10px 8px' }}>{row.cantidad}</td>
                      <td style={{ padding: '10px 8px' }}>{money(row.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderTop: `1px solid ${T.border}` }}>
                    <td colSpan={5} style={{ padding: '18px 8px', color: T.textMid, textAlign: 'center' }}>
                      No hay datos de productos para el rango seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && reporteActivo === 'stock' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {[
              { label: 'Total unidades', value: totalUnidades.toLocaleString() },
              { label: 'Productos bajo minimo', value: productosBajoMinimo.toLocaleString() },
              { label: 'Sucursales', value: sucursales.length.toLocaleString() },
            ].map((item) => (
              <div key={item.label} style={cardStyle}>
                <div style={{ fontSize: 11, color: T.textMid, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ color: T.textMid, fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Producto</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Min</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Total</th>
                    {sucursales.map((sucursal: any) => (
                      <th key={sucursal.id} style={{ textAlign: 'left', padding: '10px 8px' }}>
                        {sucursal.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productosConStock.map((row: any) => (
                    <tr key={row.producto_id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 8px' }}>{row.nombre}</td>
                      <td style={{ padding: '10px 8px', fontFamily: `${T.fontMono}, monospace` }}>{row.sku}</td>
                      <td style={{ padding: '10px 8px' }}>{row.stock_minimo}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{row.total}</td>
                      {sucursales.map((sucursal: any) => {
                        const cantidad = Number(row.sucursales?.[sucursal.id] || 0);
                        const bajoMin = cantidad < Number(row.stock_minimo || 0);
                        return (
                          <td
                            key={`${row.producto_id}-${sucursal.id}`}
                            style={{
                              padding: '10px 8px',
                              color: bajoMin ? '#f59e0b' : T.text,
                              fontWeight: bajoMin ? 700 : 400,
                            }}
                          >
                            {cantidad}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && reporteActivo === 'canales' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ width: '100%', height: 360, minWidth: 0, overflow: 'hidden' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datosCanales || []}
                    dataKey="total"
                    nameKey="canal"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                  >
                    {(datosCanales || []).map((_: any, index: number) => (
                      <Cell key={index} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => money(Number(value || 0))}
                    contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}` }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: T.textMid, fontSize: 11 }}>
                  {['Canal', 'Pedidos', 'Total S/', '%'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: '10px 8px' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(datosCanales || []).map((row: any) => (
                  <tr key={row.canal} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '10px 8px' }}>{row.canal}</td>
                    <td style={{ padding: '10px 8px' }}>{row.pedidos}</td>
                    <td style={{ padding: '10px 8px' }}>{money(row.total)}</td>
                    <td style={{ padding: '10px 8px' }}>{row.porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
