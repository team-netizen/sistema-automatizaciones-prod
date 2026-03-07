// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';
import { ViewMovimientos } from './ViewMovimientos';
import { ViewStockEncargado } from './ViewStockEncargado';
import { ViewTransferenciasEncargado } from './ViewTransferenciasEncargado';

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

const NAV = [
  { id: 'home', label: 'Inicio', icon: '🏠' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'transferencias', label: 'Transferencias', icon: '🔄' },
  { id: 'pedidos', label: 'Pedidos', icon: '🛒' },
  { id: 'reportes', label: 'Reportes', icon: '📊' },
  { id: 'movimientos', label: 'Movimientos', icon: '📋' },
  { id: 'alertas', label: 'Alertas', icon: '🔔' },
];

const cardStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
};

const buttonGhost = {
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  background: T.surface,
  color: T.textMid,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 12px',
};

const badgeStyle = {
  alignItems: 'center',
  background: T.accentLight,
  borderRadius: 999,
  color: T.accent,
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 700,
  gap: 6,
  padding: '8px 12px',
};

function toRows(payload: any, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function money(value: number) {
  return `S/ ${Number(value || 0).toLocaleString()}`;
}

function formatDateLabel(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEstadoStock(cantidad: number, minimo: number) {
  if (cantidad <= 0) return { label: 'Sin stock', color: T.danger, bg: '#fee2e2' };
  if (cantidad < minimo) return { label: 'Bajo', color: T.warning, bg: '#fef3c7' };
  return { label: 'OK', color: T.accent, bg: T.accentLight };
}

function getTransferenciaTipo(row: any, sucursalId: string) {
  if (String(row?.sucursal_destino_id || '') === String(sucursalId || '')) return 'Entrada';
  return 'Salida';
}

function isPedidoValido(row: any) {
  return !['cancelado', 'rechazado'].includes(String(row?.estado || '').toLowerCase());
}

function PlaceholderView({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ ...cardStyle, minHeight: 320, padding: 28 }}>
      <div style={{ color: T.text, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ color: T.textMid, fontSize: 14, maxWidth: 540 }}>{detail}</div>
    </div>
  );
}

export const EncargadoDashboard = ({ usuario, onLogout }: { usuario?: any; onLogout?: () => void }) => {
  const [view, setView] = useState('home');
  const [loading, setLoading] = useState(true);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [nombreSucursal, setNombreSucursal] = useState('Cargando...');
  const [mostrarAlertas, setMostrarAlertas] = useState(false);
  const [errorAlertas, setErrorAlertas] = useState('');

  const empresaNombre = usuario?.empresa_nombre || usuario?.empresa || 'Sistema';
  const usuarioNombre = usuario?.nombre || usuario?.email || 'Usuario';
  const sucursalId = String(usuario?.sucursal_id || '');

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-alertas-dropdown]')) {
        setMostrarAlertas(false);
      }
    };

    if (mostrarAlertas) {
      document.addEventListener('click', handleClick);
    }

    return () => document.removeEventListener('click', handleClick);
  }, [mostrarAlertas]);

  useEffect(() => {
    const cargarSucursal = async () => {
      if (!usuario?.sucursal_id) {
        setNombreSucursal('Sin sucursal');
        return;
      }

      const sucursales = await operacionesService.getSucursales();
      const rows = Array.isArray(sucursales) ? sucursales : sucursales?.sucursales || [];
      const sucursal = rows.find((s: any) => s.id === usuario.sucursal_id);
      setNombreSucursal(sucursal?.nombre || 'Sin sucursal');
    };

    void cargarSucursal();
  }, [usuario?.sucursal_id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorAlertas('');
      try {
        const [stockRes, pedidosRes, transferenciasRes, alertasRes, sucursalesRes] =
          await Promise.allSettled([
            operacionesService.getStockPorSucursal?.(sucursalId),
            operacionesService.getPedidos?.(),
            operacionesService.getTransferencias?.({ sucursal_id: sucursalId }),
            operacionesService.getAlertas?.({ limit: 20 }),
            operacionesService.getSucursales?.(),
          ]);

        if (stockRes.status === 'fulfilled') {
          setStockRows(toRows(stockRes.value, ['stock', 'data', 'items']));
        }

        if (pedidosRes.status === 'fulfilled') {
          setPedidos(toRows(pedidosRes.value, ['pedidos', 'data', 'items']));
        }

        if (transferenciasRes.status === 'fulfilled') {
          setTransferencias(toRows(transferenciasRes.value, ['transferencias', 'data', 'items']));
        }

        if (alertasRes.status === 'fulfilled') {
          setAlertas(toRows(alertasRes.value, ['alertas', 'data', 'items']));
          setErrorAlertas('');
        } else {
          setAlertas([]);
          setErrorAlertas(alertasRes.reason?.message || 'No se pudieron cargar alertas.');
        }

      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sucursalId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await operacionesService.getAlertas?.({ limit: 20 });
        setAlertas(toRows(data, ['alertas', 'data', 'items']));
      } catch {
        // noop
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const stockSucursal = useMemo(
    () => stockRows.filter((row: any) => String(row?.sucursal_id || '') === sucursalId),
    [stockRows, sucursalId],
  );

  const pedidosSucursal = useMemo(
    () =>
      pedidos.filter((row: any) => {
        const directa = String(row?.sucursal_id || '') === sucursalId;
        const asignada = String(row?.sucursal_asignada_id || '') === sucursalId;
        return directa || asignada;
      }),
    [pedidos, sucursalId],
  );

  const transferenciasSucursal = useMemo(
    () =>
      transferencias.filter((row: any) => {
        const origen = String(row?.sucursal_origen_id || '') === sucursalId;
        const destino = String(row?.sucursal_destino_id || '') === sucursalId;
        return origen || destino;
      }),
    [transferencias, sucursalId],
  );

  const hoy = new Date().toISOString().split('T')[0];
  const totalUnidades = stockSucursal.reduce((sum: number, row: any) => sum + Number(row?.cantidad || 0), 0);
  const productosBajoMinimo = stockSucursal.filter((row: any) => {
    const minimo = Number(row?.stock_minimo ?? row?.producto?.stock_minimo ?? 0);
    return minimo > 0 && Number(row?.cantidad || 0) < minimo;
  }).length;

  const pedidosHoyRows = pedidosSucursal.filter((row: any) => {
    const fecha = String(row?.fecha_creacion || row?.fecha_pedido || '').split('T')[0];
    return fecha === hoy && isPedidoValido(row);
  });
  const totalHoy = pedidosHoyRows.reduce((sum: number, row: any) => sum + Number(row?.total || 0), 0);
  const transferenciasPendientes = transferenciasSucursal.filter((row: any) => row?.estado === 'pendiente').length;
  const transferenciasEnTransito = transferenciasSucursal.filter(
    (row: any) => ['en_transito', 'aprobada'].includes(String(row?.estado || '')),
  ).length;
  const alertasNoLeidas = alertas.filter((row: any) => !row?.leida).length;

  const quickStock = [...stockSucursal]
    .sort((a: any, b: any) => Number(a?.cantidad || 0) - Number(b?.cantidad || 0))
    .slice(0, 5);

  const transferenciasRecientes = [...transferenciasSucursal]
    .sort((a: any, b: any) => {
      const aDate = new Date(a?.fecha_creacion || a?.created_at || 0).getTime();
      const bDate = new Date(b?.fecha_creacion || b?.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);

  const kpis = [
    {
      label: 'Stock total',
      value: Number(totalUnidades || 0).toLocaleString(),
      icon: '📦',
      sub: `${productosBajoMinimo} bajo mínimo`,
      subColor: productosBajoMinimo > 0 ? T.warning : T.accentMid,
    },
    {
      label: 'Pedidos hoy',
      value: Number(pedidosHoyRows.length || 0).toLocaleString(),
      icon: '🛒',
      sub: `${money(totalHoy)} en ventas`,
      subColor: T.textLight,
    },
    {
      label: 'Transferencias pendientes',
      value: Number(transferenciasPendientes || 0).toLocaleString(),
      icon: '🔄',
      sub: `${transferenciasEnTransito} en tránsito`,
      subColor: T.textLight,
    },
    {
      label: 'Alertas activas',
      value: Number(alertasNoLeidas || 0).toLocaleString(),
      icon: '🔔',
      sub: 'Sin leer',
      subColor: alertasNoLeidas > 0 ? T.danger : T.accentMid,
    },
  ];

  const marcarAlerta = async (id: string) => {
    try {
      await operacionesService.marcarAlertaLeida?.(id);
      setAlertas((prev) => prev.map((row: any) => (row?.id === id ? { ...row, leida: true } : row)));
    } catch (error: any) {
      setErrorAlertas(error?.message || 'No se pudo marcar la alerta.');
    }
  };

  const marcarTodas = async () => {
    try {
      await operacionesService.marcarTodasAlertasLeidas?.();
      setAlertas((prev) => prev.map((row: any) => ({ ...row, leida: true })));
      setErrorAlertas('');
    } catch (error: any) {
      setErrorAlertas(error?.message || 'No se pudieron marcar las alertas.');
    }
  };

  const renderHome = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {kpis.map((item) => (
          <div
            key={item.label}
            style={{
              background: T.surface,
              borderRadius: T.radius,
              padding: '20px 24px',
              boxShadow: T.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: T.textMid }}>{item.label}</span>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: T.text }}>{item.value}</div>
            <div style={{ fontSize: 12, color: item.subColor || T.textLight }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.25fr 1fr' }}>
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div
            style={{
              alignItems: 'center',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              padding: '18px 20px',
            }}
          >
            <div>
              <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>Stock rápido</div>
              <div style={{ color: T.textMid, fontSize: 13 }}>Top 5 productos con menor stock</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ color: T.textMid, fontSize: 12, textAlign: 'left' }}>
                  {['Producto', 'SKU', 'Stock actual', 'Mínimo', 'Estado'].map((label) => (
                    <th key={label} style={{ padding: '14px 20px', fontWeight: 700 }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quickStock.length > 0 ? (
                  quickStock.map((row: any) => {
                    const cantidad = Number(row?.cantidad || 0);
                    const minimo = Number(row?.stock_minimo ?? row?.producto?.stock_minimo ?? 0);
                    const estado = getEstadoStock(cantidad, minimo);
                    return (
                      <tr key={`${row?.producto_id || row?.sku}-${row?.sucursal_id || 'stock'}`} style={{ borderTop: `1px solid ${T.border}` }}>
                        <td style={{ padding: '14px 20px', color: T.text, fontWeight: 600 }}>
                          {row?.producto_nombre || row?.nombre || row?.producto?.nombre || 'Producto'}
                        </td>
                        <td style={{ padding: '14px 20px', color: T.textMid }}>{row?.producto_sku || row?.sku || row?.producto?.sku || '-'}</td>
                        <td style={{ padding: '14px 20px', color: T.text }}>{cantidad}</td>
                        <td style={{ padding: '14px 20px', color: T.textMid }}>{minimo}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              background: estado.bg,
                              borderRadius: 999,
                              color: estado.color,
                              display: 'inline-flex',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '5px 10px',
                            }}
                          >
                            {estado.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr style={{ borderTop: `1px solid ${T.border}` }}>
                    <td colSpan={5} style={{ color: T.textMid, padding: '20px', textAlign: 'center' }}>
                      No hay stock registrado para esta sucursal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div
            style={{
              alignItems: 'center',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              padding: '18px 20px',
            }}
          >
            <div>
              <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>Transferencias recientes</div>
              <div style={{ color: T.textMid, fontSize: 13 }}>Ultimos movimientos de esta sucursal</div>
            </div>
          </div>

          <div style={{ display: 'grid' }}>
            {transferenciasRecientes.length > 0 ? (
              transferenciasRecientes.map((row: any) => (
                <div
                  key={row?.id || `${row?.sucursal_origen_id}-${row?.sucursal_destino_id}-${row?.fecha_creacion}`}
                  style={{
                    borderTop: `1px solid ${T.border}`,
                    display: 'grid',
                    gap: 4,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>
                      {formatDateLabel(row?.fecha_creacion || row?.created_at || '')}
                    </span>
                    <span
                      style={{
                        background: String(row?.estado || '') === 'pendiente' ? '#fef3c7' : T.accentLight,
                        borderRadius: 999,
                        color: String(row?.estado || '') === 'pendiente' ? T.warning : T.accent,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 9px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {String(row?.estado || '-').replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ color: T.textMid, fontSize: 13 }}>
                    {getTransferenciaTipo(row, sucursalId)} · {Number(row?.items?.length || row?.total_items || row?.items_count || 0)} productos
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: T.textMid, padding: '20px', textAlign: 'center' }}>
                No hay transferencias recientes para esta sucursal.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ ...cardStyle, minHeight: 240, padding: 28 }}>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>Cargando dashboard...</div>
        </div>
      );
    }

    switch (view) {
      case 'home':
        return renderHome();
      case 'stock':
        return <ViewStockEncargado usuario={usuario} />;
      case 'transferencias':
        return <ViewTransferenciasEncargado usuario={usuario} />;
      case 'pedidos':
        return (
          <PlaceholderView
            title="Pedidos"
            detail="Esta vista quedara enfocada en los pedidos asignados a la sucursal del encargado."
          />
        );
      case 'reportes':
        return (
          <PlaceholderView
            title="Reportes"
            detail="Se conectara con los reportes operativos filtrados por la sucursal asignada."
          />
        );
      case 'movimientos':
        return <ViewMovimientos usuario={usuario} />;
      case 'alertas':
        return (
          <PlaceholderView
            title="Alertas"
            detail="Esta vista quedara dedicada al listado completo de alertas activas y leidas de la sucursal."
          />
        );
      default:
        return renderHome();
    }
  };

  return (
    <div style={{ background: T.bg, color: T.text, display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          boxShadow: '6px 0 18px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          width: 220,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: T.accent, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>SIS AUTO</div>
          <div style={{ color: T.textMid, fontSize: 12, marginTop: 6 }}>Panel de sucursal</div>
        </div>

        <nav style={{ display: 'grid', gap: 8 }}>
          {NAV.map((item) => {
            const active = item.id === view;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
                style={{
                  alignItems: 'center',
                  background: active ? T.accentLight : 'transparent',
                  border: `1px solid ${active ? '#b7e4c7' : 'transparent'}`,
                  borderRadius: 12,
                  color: active ? T.accent : T.textMid,
                  cursor: 'pointer',
                  display: 'flex',
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  gap: 10,
                  justifyContent: 'flex-start',
                  padding: '12px 14px',
                  textAlign: 'left',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 'auto', paddingTop: 16 }}>
          <button
            onClick={onLogout}
            type="button"
            style={{
              alignItems: 'center',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 12,
              color: T.textMid,
              cursor: 'pointer',
              display: 'flex',
              fontSize: 14,
              fontWeight: 600,
              gap: 10,
              justifyContent: 'flex-start',
              padding: '12px 14px',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span>↩</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            alignItems: 'center',
            background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            height: 60,
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>{empresaNombre}</div>

          <div style={badgeStyle}>
            <span>📍</span>
            <span>{nombreSucursal}</span>
          </div>

          <div style={{ alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <div data-alertas-dropdown style={{ position: 'relative' }}>
              <button
                onClick={() => setMostrarAlertas((prev) => !prev)}
                style={{
                  ...buttonGhost,
                  alignItems: 'center',
                  display: 'inline-flex',
                  gap: 8,
                  position: 'relative',
                }}
                type="button"
              >
                <span>🔔</span>
                <span>Alertas</span>
                {alertasNoLeidas > 0 && (
                  <span
                    style={{
                      background: T.danger,
                      borderRadius: 999,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 18,
                      padding: '3px 6px',
                      textAlign: 'center',
                    }}
                  >
                    {alertasNoLeidas > 9 ? '9+' : alertasNoLeidas}
                  </span>
                )}
              </button>

              {mostrarAlertas && (
                <div
                  style={{
                    ...cardStyle,
                    padding: 0,
                    position: 'absolute',
                    right: 0,
                    top: 44,
                    width: 360,
                    zIndex: 30,
                  }}
                >
                  <div
                    style={{
                      alignItems: 'center',
                      borderBottom: `1px solid ${T.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                    }}
                  >
                    <div>
                      <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>Notificaciones</div>
                      <div style={{ color: T.textMid, fontSize: 12 }}>{alertasNoLeidas} sin leer</div>
                    </div>
                    <button onClick={() => void marcarTodas()} style={buttonGhost} type="button">
                      Marcar todas
                    </button>
                  </div>

                  {errorAlertas && (
                    <div style={{ color: T.warning, fontSize: 12, padding: '12px 16px' }}>{errorAlertas}</div>
                  )}

                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {alertas.length > 0 ? (
                      alertas.map((alerta: any) => (
                        <button
                          key={alerta?.id || alerta?.mensaje}
                          onClick={() => void (alerta?.leida ? Promise.resolve() : marcarAlerta(alerta.id))}
                          style={{
                            background: alerta?.leida ? '#fff' : T.accentLight,
                            border: 'none',
                            borderBottom: `1px solid ${T.border}`,
                            color: T.text,
                            cursor: 'pointer',
                            display: 'grid',
                            gap: 4,
                            padding: '14px 16px',
                            textAlign: 'left',
                            width: '100%',
                          }}
                          type="button"
                        >
                          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>
                              {alerta?.mensaje || 'Alerta'}
                            </span>
                            {!alerta?.leida && (
                              <span
                                style={{
                                  background: T.danger,
                                  borderRadius: 999,
                                  display: 'inline-block',
                                  height: 8,
                                  width: 8,
                                }}
                              />
                            )}
                          </div>
                          <div style={{ color: T.textMid, fontSize: 12 }}>
                            {formatDateLabel(alerta?.fecha_generada || alerta?.created_at || '')}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div style={{ color: T.textMid, fontSize: 13, padding: '18px 16px', textAlign: 'center' }}>
                        No hay alertas para mostrar.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
              <div
                style={{
                  alignItems: 'center',
                  background: T.accentLight,
                  borderRadius: 999,
                  color: T.accent,
                  display: 'flex',
                  fontSize: 13,
                  fontWeight: 800,
                  height: 36,
                  justifyContent: 'center',
                  width: 36,
                }}
              >
                {String(usuarioNombre).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{usuarioNombre}</div>
                <div style={{ color: T.textMid, fontSize: 11 }}>encargado_sucursal</div>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: T.text, fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
              Dashboard de sucursal
            </div>
            <div style={{ color: T.textMid, fontSize: 14 }}>
              Vista operativa enfocada solo en tu sucursal asignada.
            </div>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
};
