import { useEffect, useMemo, useState } from 'react';

type EstadoFiltro = 'todas' | 'no_leidas' | 'leidas';
type TipoFiltro = 'todos' | 'stock_bajo' | 'ajuste_stock_manual' | 'transferencia' | 'otro';

interface AlertasSucursalProps {
  usuarioId: string;
  empresaId: string;
  token: string;
  apiBase: string;
}

interface NotificacionRow {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  canal: string | null;
  fecha_creacion: string;
}

const T = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  accent: '#2d6a4f',
  accentLight: '#d1fae5',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
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

const ESTADO_TABS: Array<{ id: EstadoFiltro; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'no_leidas', label: 'No leidas' },
  { id: 'leidas', label: 'Leidas' },
];

const TIPO_OPTIONS: Array<{ value: TipoFiltro; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'stock_bajo', label: 'Stock bajo' },
  { value: 'ajuste_stock_manual', label: 'Ajuste stock' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
];

function normalizeApiBase(apiBase: string): string {
  return apiBase.replace(/\/+$/, '');
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);

  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
  return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} ${hora}`;
}

function getTipoBadge(tipo: string): { label: string; background: string; color: string } {
  const key = String(tipo || '').toLowerCase();

  if (key === 'stock_bajo') {
    return { label: 'Stock bajo', background: T.warningLight, color: T.warning };
  }

  if (key === 'ajuste_stock_manual') {
    return { label: 'Ajuste stock', background: T.violetLight, color: T.violet };
  }

  if (key === 'transferencia') {
    return { label: 'Transferencia', background: T.infoLight, color: T.info };
  }

  return { label: 'Sistema', background: '#f3f4f6', color: T.textMuted };
}

function Spinner() {
  return (
    <div
      style={{
        animation: 'alertas-spin 1s linear infinite',
        border: `3px solid ${T.border}`,
        borderRadius: '50%',
        borderTopColor: T.accent,
        height: 26,
        width: 26,
      }}
    />
  );
}

export default function AlertasSucursal({
  usuarioId,
  empresaId,
  token,
  apiBase,
}: AlertasSucursalProps) {
  const [alertas, setAlertas] = useState<NotificacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todas');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlertas = async (options?: { silent?: boolean }) => {
    if (!usuarioId || !empresaId || !token) {
      setAlertas([]);
      setLoading(false);
      return false;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        usuarioId,
        empresaId,
      });

      const response = await fetch(`${normalizeApiBase(apiBase)}/api/operaciones/alertas?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setAlertas([]);
        setError('Sesion expirada. Vuelve a iniciar sesion.');
        return false;
      }

      if (!response.ok) {
        let message = 'No se pudieron cargar las alertas.';
        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch {
          // noop
        }
        throw new Error(message);
      }

      const payload = await response.json();
      setAlertas(Array.isArray(payload) ? payload : []);
      setError('');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red al cargar alertas.';
      if (!options?.silent) {
        setAlertas([]);
        setError(message);
      }
      return true;
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let pollingActivo = true;

    void fetchAlertas().then((shouldContinue) => {
      if (shouldContinue === false) {
        pollingActivo = false;
      }
    });

    const interval = window.setInterval(async () => {
      if (!pollingActivo) {
        window.clearInterval(interval);
        return;
      }

      const shouldContinue = await fetchAlertas({ silent: true });
      if (shouldContinue === false) {
        pollingActivo = false;
        window.clearInterval(interval);
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [apiBase, empresaId, token, usuarioId]);

  const alertasFiltradas = useMemo(() => {
    return alertas.filter((alerta) => {
      const coincideEstado = estadoFiltro === 'todas'
        ? true
        : estadoFiltro === 'no_leidas'
          ? !alerta.leida
          : alerta.leida;

      const tipo = String(alerta.tipo || '').toLowerCase();
      const coincideTipo = tipoFiltro === 'todos'
        ? true
        : tipoFiltro === 'otro'
          ? !['stock_bajo', 'ajuste_stock_manual', 'transferencia'].includes(tipo)
          : tipo === tipoFiltro;

      return coincideEstado && coincideTipo;
    });
  }, [alertas, estadoFiltro, tipoFiltro]);

  const noLeidas = alertas.filter((alerta) => !alerta.leida).length;

  const marcarUnaLeida = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${normalizeApiBase(apiBase)}/api/operaciones/alertas/${id}/leida`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = 'No se pudo marcar la alerta.';
        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch {
          // noop
        }
        throw new Error(message);
      }

      await fetchAlertas({ silent: true });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la alerta.');
    } finally {
      setActionLoading(false);
    }
  };

  const marcarTodas = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${normalizeApiBase(apiBase)}/api/operaciones/alertas/marcar-todas-leidas`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuarioId, empresaId }),
      });

      if (!response.ok) {
        let message = 'No se pudieron marcar las alertas.';
        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch {
          // noop
        }
        throw new Error(message);
      }

      await fetchAlertas({ silent: true });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron marcar las alertas.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ color: T.text, display: 'grid', gap: 16, fontFamily: "'DM Sans', 'Nunito', sans-serif", paddingBottom: '40px' }}>
      <style>
        {`
          @keyframes alertas-spin {
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
          gap: 14,
          padding: 20,
        }}
      >
        <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 800 }}>Alertas</div>
            <div style={{ color: T.textMuted, fontSize: 14, marginTop: 6 }}>
              {noLeidas} notificaciones sin leer
            </div>
          </div>

          <button
            disabled={noLeidas === 0 || actionLoading}
            onClick={() => void marcarTodas()}
            type="button"
            style={{
              background: noLeidas === 0 || actionLoading ? '#edf0f4' : T.accent,
              border: 'none',
              borderRadius: T.radiusSm,
              color: noLeidas === 0 || actionLoading ? T.textMuted : '#fff',
              cursor: noLeidas === 0 || actionLoading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 800,
              padding: '11px 14px',
            }}
          >
            Marcar todas como leidas
          </button>
        </div>

        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              padding: 6,
            }}
          >
            {ESTADO_TABS.map((item) => {
              const active = estadoFiltro === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setEstadoFiltro(item.id)}
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

          <select
            value={tipoFiltro}
            onChange={(event) => setTipoFiltro(event.target.value as TipoFiltro)}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              color: T.text,
              fontSize: 13,
              padding: '10px 12px',
            }}
          >
            {TIPO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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

      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div
            style={{
              alignItems: 'center',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              boxShadow: T.shadow,
              display: 'grid',
              justifyItems: 'center',
              minHeight: 220,
              rowGap: 12,
            }}
          >
            <Spinner />
            <div style={{ color: T.textMuted, fontSize: 13 }}>Cargando alertas...</div>
          </div>
        ) : alertasFiltradas.length === 0 ? (
          <div
            style={{
              alignItems: 'center',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              boxShadow: T.shadow,
              color: T.textMuted,
              display: 'grid',
              justifyItems: 'center',
              minHeight: 220,
              rowGap: 8,
            }}
          >
            <div style={{ fontSize: 34 }}>🔕</div>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>No tienes notificaciones pendientes</div>
          </div>
        ) : (
          alertasFiltradas.map((alerta) => {
            const badge = getTipoBadge(alerta.tipo);

            return (
              <div
                key={alerta.id}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = T.bg;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = alerta.leida ? T.surface : '#f0faf5';
                }}
                style={{
                  background: alerta.leida ? T.surface : '#f0faf5',
                  border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${alerta.leida ? T.border : T.accent}`,
                  borderRadius: T.radius,
                  boxShadow: T.shadow,
                  display: 'grid',
                  gap: 10,
                  padding: '18px 20px',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <div style={{ alignItems: 'center', display: 'flex', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>🔔</span>
                    <span
                      style={{
                        background: badge.background,
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
                  </div>

                  <div style={{ color: alerta.leida ? T.textLight : T.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatFecha(alerta.fecha_creacion)}
                  </div>
                </div>

                <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                  <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                    <div style={{ color: alerta.leida ? T.textMuted : T.text, fontSize: 16, fontWeight: 800 }}>
                      {alerta.titulo || 'Notificacion'}
                    </div>
                    <div style={{ color: alerta.leida ? T.textLight : T.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                      {alerta.mensaje || 'Sin detalle adicional.'}
                    </div>
                  </div>

                  {!alerta.leida && (
                    <button
                      disabled={actionLoading}
                      onClick={() => void marcarUnaLeida(alerta.id)}
                      type="button"
                      style={{
                        background: T.accentLight,
                        border: 'none',
                        borderRadius: 999,
                        color: T.accent,
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: 14,
                        fontWeight: 800,
                        minWidth: 34,
                        padding: '7px 10px',
                      }}
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
