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
  textMid: '#4d6b58',
  text: '#e8f5ee',
  font: 'DM Sans',
  fontMono: 'DM Mono',
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

const btnPrimary = {
  background: `${T.accent}18`,
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

interface ViewStockProps {
  usuario?: any;
}

export const ViewStock = ({ usuario }: ViewStockProps) => {
  void usuario;

  const [stockData, setStockData] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('todas');

  // Modal ajuste de stock
  const [modalAjuste, setModalAjuste] = useState(false);
  const [ajusteProducto, setAjusteProducto] = useState<any>(null);
  const [ajusteSucursal, setAjusteSucursal] = useState<any>(null);
  const [ajusteTipo, setAjusteTipo] = useState<'entrada' | 'salida'>('entrada');
  const [ajusteCantidad, setAjusteCantidad] = useState(0);
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState('');

  useEffect(() => {
    const stockPromise = operacionesService.getStock
      ? operacionesService.getStock()
      : operacionesService.getStockPorSucursal();

    void Promise.all([stockPromise, operacionesService.getSucursales()])
      .then(([stockRes, sucRes]) => {
        setStockData(Array.isArray(stockRes) ? stockRes : stockRes?.stock || []);
        setSucursales(Array.isArray(sucRes) ? sucRes : sucRes?.sucursales || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Agrupar por producto con stock por sucursal
  const productosConStock = useMemo(() => {
    const map = new Map<string, any>();

    stockData.forEach((item) => {
      const key = item.producto_id;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          producto_id: item.producto_id,
          nombre:
            item.producto_nombre
            || item.nombre
            || item.producto?.nombre
            || 'Sin nombre',
          sku: item.producto_sku || item.sku || item.producto?.sku || '—',
          stock_minimo: item.stock_minimo ?? item.producto?.stock_minimo ?? 0,
          sucursales: {},
          total: 0,
        });
      }

      const prod = map.get(key);
      prod.sucursales[item.sucursal_id] = {
        cantidad: item.cantidad || 0,
        cantidad_reservada: item.cantidad_reservada || 0,
      };
      prod.total += item.cantidad || 0;
    });

    return Array.from(map.values()).filter(
      (p) =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
        || p.sku.toLowerCase().includes(busqueda.toLowerCase()),
    );
  }, [stockData, busqueda]);

  // Sucursales a mostrar segun filtro
  const sucursalesMostrar = filtroSucursal === 'todas'
    ? sucursales
    : sucursales.filter((s) => s.id === filtroSucursal);

  // Productos con stock bajo en alguna sucursal
  const alertasStockBajo = productosConStock.filter((p) =>
    Object.values(p.sucursales).some((s: any) => s.cantidad < p.stock_minimo && s.cantidad >= 0),
  );

  const abrirModalAjuste = (producto: any, sucursal: any) => {
    setAjusteProducto(producto);
    setAjusteSucursal(sucursal);
    setAjusteTipo('entrada');
    setAjusteCantidad(0);
    setAjusteMotivo('Ajuste de inventario');
    setErrorAjuste('');
    setModalAjuste(true);
  };

  const confirmarAjuste = async () => {
    if (ajusteCantidad <= 0) {
      setErrorAjuste('La cantidad debe ser mayor a 0');
      return;
    }

    const stockActual = ajusteProducto?.sucursales?.[ajusteSucursal?.id]?.cantidad || 0;
    if (ajusteTipo === 'salida' && ajusteCantidad > stockActual) {
      setErrorAjuste(`Stock insuficiente. Disponible: ${stockActual}`);
      return;
    }

    setGuardandoAjuste(true);
    setErrorAjuste('');
    try {
      if (!operacionesService.ajustarStock) {
        throw new Error('Metodo ajustarStock no disponible');
      }

      await operacionesService.ajustarStock({
        producto_id: ajusteProducto.producto_id,
        sucursal_id: ajusteSucursal.id,
        tipo: ajusteTipo,
        cantidad: ajusteCantidad,
        motivo: ajusteMotivo,
      });

      // Actualizar estado local
      setStockData((prev) =>
        prev.map((item) => {
          if (
            item.producto_id === ajusteProducto.producto_id
            && item.sucursal_id === ajusteSucursal.id
          ) {
            const nuevaCantidad = ajusteTipo === 'entrada'
              ? item.cantidad + ajusteCantidad
              : item.cantidad - ajusteCantidad;
            return { ...item, cantidad: Math.max(0, nuevaCantidad) };
          }
          return item;
        }),
      );

      // Forzar sync WooCommerce
      operacionesService.forzarSyncWooCommerce().catch(() => {});

      setModalAjuste(false);
    } catch (err: any) {
      setErrorAjuste(err.message || 'Error al ajustar stock');
    } finally {
      setGuardandoAjuste(false);
    }
  };

  const totalPorSucursal = (sucursalId: string) =>
    productosConStock.reduce(
      (sum, p) => sum + Number(p?.sucursales?.[sucursalId]?.cantidad || 0),
      0,
    );

  const totalGeneral = productosConStock.reduce((sum, p) => sum + Number(p?.total || 0), 0);

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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Stock</h2>
        <div style={{ marginTop: 4, fontSize: 11, color: T.textMid }}>
          {productosConStock.length} productos
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto o SKU..."
            style={{ ...inputStyle, minWidth: 260 }}
          />
          <select
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
            style={inputStyle}
          >
            <option value="todas">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {alertasStockBajo.length > 0 && (
        <div
          style={{
            background: '#f59e0b18',
            border: '1px solid #f59e0b33',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            color: '#f59e0b',
            fontSize: 12,
          }}
        >
          {alertasStockBajo.length} producto(s) con stock bajo el minimo
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: T.bg }}>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Stock min</th>
              {sucursalesMostrar.map((s) => (
                <th key={s.id} style={{ ...thStyle, textAlign: 'center' }}>
                  {s.nombre}
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'center' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4 + sucursalesMostrar.length} style={emptyStyle}>
                  Cargando stock...
                </td>
              </tr>
            )}

            {!loading && productosConStock.length === 0 && (
              <tr>
                <td colSpan={4 + sucursalesMostrar.length} style={emptyStyle}>
                  No hay productos para mostrar.
                </td>
              </tr>
            )}

            {!loading &&
              productosConStock.map((producto) => (
                <tr key={producto.producto_id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={tdMono}>{producto.sku}</td>
                  <td style={tdText}>{producto.nombre}</td>
                  <td style={{ ...tdMono, textAlign: 'center' }}>{producto.stock_minimo}</td>
                  {sucursalesMostrar.map((s) => {
                    const cell = producto?.sucursales?.[s.id] || { cantidad: 0, cantidad_reservada: 0 };
                    const cantidad = Number(cell.cantidad || 0);
                    const stockMin = Number(producto.stock_minimo || 0);
                    return (
                      <td
                        key={`${producto.producto_id}-${s.id}`}
                        onClick={() => abrirModalAjuste(producto, s)}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'center',
                          padding: '10px 16px',
                          fontFamily: `${T.fontMono}, monospace`,
                          fontWeight: 700,
                          fontSize: 14,
                          color:
                            cantidad === 0 ? '#ef4444' : cantidad < stockMin ? '#f59e0b' : '#00e87b',
                          background:
                            cantidad === 0
                              ? '#ef444408'
                              : cantidad < stockMin
                                ? '#f59e0b08'
                                : 'transparent',
                        }}
                      >
                        {cantidad}
                      </td>
                    );
                  })}
                  <td style={{ ...tdMono, textAlign: 'center', color: T.accent }}>{producto.total}</td>
                </tr>
              ))}

            {!loading && productosConStock.length > 0 && (
              <tr style={{ borderTop: `1px solid ${T.border2}`, background: T.surface2 }}>
                <td style={tdMono}>-</td>
                <td style={{ ...tdText, fontWeight: 800, color: T.accent }}>TOTALES</td>
                <td style={tdMono}>-</td>
                {sucursalesMostrar.map((s) => (
                  <td key={`total-${s.id}`} style={{ ...tdMono, textAlign: 'center', color: T.accent }}>
                    {totalPorSucursal(s.id)}
                  </td>
                ))}
                <td style={{ ...tdMono, textAlign: 'center', color: T.accent }}>{totalGeneral}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAjuste && (
        <div onClick={() => !guardandoAjuste && setModalAjuste(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Ajustar Stock</h3>
            <div style={{ color: T.textMid, fontSize: 12 }}>
              {ajusteProducto?.nombre} - {ajusteSucursal?.nombre}
            </div>

            <div style={{ fontSize: 12, color: T.text }}>
              Stock actual: {ajusteProducto?.sucursales?.[ajusteSucursal?.id]?.cantidad || 0} unidades
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setAjusteTipo('entrada')}
                style={{
                  ...(ajusteTipo === 'entrada' ? btnPrimary : btnGhost),
                  padding: '7px 12px',
                }}
              >
                Entrada
              </button>
              <button
                onClick={() => setAjusteTipo('salida')}
                style={{
                  ...(ajusteTipo === 'salida' ? btnPrimary : btnGhost),
                  padding: '7px 12px',
                }}
              >
                Salida
              </button>
            </div>

            <input
              type="number"
              min={1}
              value={ajusteCantidad}
              onChange={(e) => setAjusteCantidad(Number(e.target.value || 0))}
              style={inputStyle}
              placeholder="Cantidad"
            />

            <select
              value={ajusteMotivo}
              onChange={(e) => setAjusteMotivo(e.target.value)}
              style={inputStyle}
            >
              <option>Compra/Recepcion de mercaderia</option>
              <option>Ajuste de inventario</option>
              <option>Devolucion de cliente</option>
              <option>Merma/Dano</option>
              <option>Correccion de error</option>
              <option>Otro</option>
            </select>

            {errorAjuste && (
              <div style={{ background: '#ef444418', border: '1px solid #ef444455', color: '#ef4444', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                {errorAjuste}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalAjuste(false)} style={btnGhost} disabled={guardandoAjuste}>
                Cancelar
              </button>
              <button onClick={() => void confirmarAjuste()} style={btnPrimary} disabled={guardandoAjuste}>
                {guardandoAjuste ? 'Guardando...' : 'Confirmar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const thStyle = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: 10,
  color: T.textMid,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontFamily: `${T.fontMono}, monospace`,
};

const tdText = {
  padding: '10px 12px',
  fontSize: 12,
  color: T.text,
};

const tdMono = {
  padding: '10px 12px',
  fontSize: 12,
  color: T.textMid,
  fontFamily: `${T.fontMono}, monospace`,
};

const emptyStyle = {
  padding: 20,
  textAlign: 'center' as const,
  color: T.textMid,
  fontSize: 12,
};

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.68)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1200,
  padding: 16,
};

const modalStyle = {
  width: 'min(540px, 96vw)',
  background: T.surface,
  border: `1px solid ${T.border2}`,
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
};
