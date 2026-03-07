import { useEffect, useMemo, useRef, useState } from 'react';
import { authFetch, NOTIFICACIONES_URL } from '../../lib/api';

type Notificacion = {
  id: string;
  titulo: string | null;
  mensaje: string | null;
  tipo: string | null;
  leida: boolean | null;
  fecha_creacion: string | null;
};

type NotificacionesBellProps = {
  iconColor?: string;
  panelBackground?: string;
  panelBorder?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
};

const DEFAULT_PROPS: Required<NotificacionesBellProps> = {
  iconColor: '#4d6b58',
  panelBackground: '#0f1419',
  panelBorder: '#151d24',
  textColor: '#e8f0e9',
  mutedColor: '#4d6b58',
  accentColor: '#00e87b',
};

function BellIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function formatFecha(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function extractList(payload: unknown): Notificacion[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item): item is Notificacion => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return typeof row.id === 'string';
    })
    .slice(0, 20);
}

async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function NotificacionesBell(props: NotificacionesBellProps) {
  const theme = useMemo(() => ({ ...DEFAULT_PROPS, ...props }), [props]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setErrorMsg('');

    try {
      const [listRes, countRes] = await Promise.all([
        authFetch(NOTIFICACIONES_URL),
        authFetch(`${NOTIFICACIONES_URL}/count`),
      ]);

      if (!listRes.ok || !countRes.ok) {
        throw new Error('No se pudieron cargar las notificaciones');
      }

      const [listPayload, countPayload] = await Promise.all([
        readJsonSafe(listRes),
        readJsonSafe(countRes),
      ]);

      const rows = extractList(listPayload);
      const total = Number((countPayload as { total?: number } | null)?.total ?? 0);

      setNotificaciones(rows);
      setNoLeidas(Number.isFinite(total) ? total : rows.filter((n) => !n.leida).length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando notificaciones';
      setErrorMsg(message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(true);
    const interval = setInterval(() => {
      void refresh(false);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [open]);

  const markAsRead = async (id: string) => {
    setUpdatingId(id);
    try {
      const response = await authFetch(`${NOTIFICACIONES_URL}/${encodeURIComponent(id)}/leida`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('No se pudo marcar como leida');
      }

      setNotificaciones((prev) =>
        prev.map((item) => (item.id === id ? { ...item, leida: true } : item)),
      );
      setNoLeidas((prev) => Math.max(0, prev - 1));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error actualizando notificacion';
      setErrorMsg(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          width: 20,
          height: 20,
        }}
        aria-label="Abrir notificaciones"
      >
        <BellIcon color={theme.iconColor} />
        {noLeidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 14,
              height: 14,
              padding: '0 4px',
              borderRadius: 99,
              background: '#ef4444',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              lineHeight: '14px',
              textAlign: 'center',
            }}
          >
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 30,
            width: 360,
            maxWidth: 'calc(100vw - 24px)',
            background: theme.panelBackground,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 10,
            boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderBottom: `1px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{ color: theme.textColor, fontSize: 11, fontWeight: 700 }}>
              Notificaciones
            </span>
            <button
              type="button"
              onClick={() => void refresh(false)}
              style={{
                border: `1px solid ${theme.panelBorder}`,
                background: 'transparent',
                color: theme.accentColor,
                borderRadius: 6,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Actualizar
            </button>
          </div>

          <div style={{ maxHeight: 330, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: 14, color: theme.mutedColor, fontSize: 11 }}>
                Cargando...
              </div>
            )}

            {!loading && errorMsg && (
              <div style={{ padding: 14, color: '#ef4444', fontSize: 11 }}>{errorMsg}</div>
            )}

            {!loading && !errorMsg && notificaciones.length === 0 && (
              <div style={{ padding: 14, color: theme.mutedColor, fontSize: 11 }}>
                No tienes notificaciones nuevas.
              </div>
            )}

            {!loading &&
              !errorMsg &&
              notificaciones.map((item) => {
                const unread = !item.leida;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderBottom: `1px solid ${theme.panelBorder}`,
                      background: unread ? 'rgba(0,232,123,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ color: theme.textColor, fontSize: 11, fontWeight: 700 }}>
                        {item.titulo || 'Notificacion'}
                      </div>
                      <div style={{ color: theme.mutedColor, fontSize: 10, whiteSpace: 'nowrap' }}>
                        {formatFecha(item.fecha_creacion)}
                      </div>
                    </div>
                    <div style={{ color: theme.mutedColor, fontSize: 11, marginTop: 3 }}>
                      {item.mensaje || 'Sin detalle'}
                    </div>
                    {unread && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => void markAsRead(item.id)}
                          style={{
                            border: `1px solid ${theme.panelBorder}`,
                            background: 'transparent',
                            color: theme.accentColor,
                            borderRadius: 6,
                            padding: '2px 8px',
                            cursor: updatingId === item.id ? 'not-allowed' : 'pointer',
                            fontSize: 10,
                            fontWeight: 600,
                            opacity: updatingId === item.id ? 0.6 : 1,
                          }}
                        >
                          Marcar leida
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
