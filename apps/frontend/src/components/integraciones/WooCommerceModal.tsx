import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactElement,
} from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

interface WooCommerceModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
  onConectado: () => void;
  onDesconectado: () => void;
}

type WooEstado = {
  activo?: boolean;
  url?: string | null;
  ultima_sync?: string | null;
  ultima_sincronizacion?: string | null;
  productos_sync?: number;
  jobs_activos?: boolean;
};

type EstadoVerificacion = 'idle' | 'loading' | 'error' | 'success';

type WooService = typeof operacionesService & {
  conectarWooCommerce: (data: {
    url: string;
    consumer_key: string;
    consumer_secret: string;
  }) => Promise<unknown>;
  desconectarWooCommerce: () => Promise<unknown>;
  forzarSyncWooCommerce: () => Promise<unknown>;
  getEstadoWooCommerce: () => Promise<WooEstado | null>;
};

const wooService = operacionesService as WooService;

const TOKENS = {
  bg: '#07090b',
  surface: '#0b0f12',
  surface2: '#0f1419',
  border: '#151d24',
  border2: '#1c2830',
  accent: '#00e87b',
  text: '#e8f0e9',
  textMid: '#4d6b58',
  textDim: '#253530',
  danger: '#ef4444',
  font: "'DM Sans', sans-serif",
  fontMono: "'DM Mono', monospace",
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Error inesperado al comunicarse con el servidor';
}

function formatFecha(fechaRaw?: string | null): string {
  if (!fechaRaw) return 'Sin sincronización';
  const d = new Date(fechaRaw);
  if (Number.isNaN(d.getTime())) return fechaRaw;
  return d.toLocaleString('es-PE');
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function WooLogo(): ReactElement {
  return (
    <svg width={34} height={34} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x={2} y={2} width={44} height={44} rx={12} fill="#7c3aed" />
      <path
        d="M11 16h6l3.5 11L24 16h4l3.5 11L35 16h6l-6 19h-6l-3-10-3 10h-6l-6-19Z"
        fill="white"
      />
    </svg>
  );
}

export function WooCommerceModal({
  isOpen,
  onClose,
  empresaId,
  onConectado,
  onDesconectado,
}: WooCommerceModalProps): ReactElement | null {
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [estadoWoo, setEstadoWoo] = useState<WooEstado | null>(null);
  const [conectado, setConectado] = useState(false);

  const [url, setUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [mostrarSecret, setMostrarSecret] = useState(false);

  const [estadoVerificacion, setEstadoVerificacion] = useState<EstadoVerificacion>('idle');
  const [mensajeVerificacion, setMensajeVerificacion] = useState('');
  const [forzandoSync, setForzandoSync] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [confirmandoDesconexion, setConfirmandoDesconexion] = useState(false);
  const [mensajeAccion, setMensajeAccion] = useState<string>('');

  const loadEstadoWoo = async (): Promise<void> => {
    setCargandoEstado(true);
    setMensajeAccion('');
    try {
      const estado = await wooService.getEstadoWooCommerce();
      const isActivo = Boolean(estado?.activo);

      setEstadoWoo(estado);
      setConectado(isActivo);

      if (isActivo && estado?.url) {
        setUrl(estado.url);
      }
    } catch (error) {
      setConectado(false);
      setEstadoWoo(null);
      setMensajeAccion(errorMessage(error));
    } finally {
      setCargandoEstado(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadEstadoWoo();
  }, [isOpen, empresaId]);

  if (!isOpen) return null;

  const handleConectar = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMensajeAccion('');

    if (!url.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      setEstadoVerificacion('error');
      setMensajeVerificacion('Completa URL, Consumer Key y Consumer Secret');
      return;
    }

    setEstadoVerificacion('loading');
    setMensajeVerificacion('Verificando conexión...');

    try {
      await wooService.conectarWooCommerce({
        url: normalizeUrl(url),
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
      });

      setEstadoVerificacion('success');
      setMensajeVerificacion('¡Conexión exitosa!');
      setConsumerSecret('');
      setConfirmandoDesconexion(false);
      await loadEstadoWoo();
      onConectado();
    } catch (error) {
      setEstadoVerificacion('error');
      setMensajeVerificacion(errorMessage(error));
    }
  };

  const handleForzarSync = async (): Promise<void> => {
    setForzandoSync(true);
    setMensajeAccion('');
    try {
      await wooService.forzarSyncWooCommerce();
      setMensajeAccion('Sincronización encolada correctamente');
      await loadEstadoWoo();
    } catch (error) {
      setMensajeAccion(errorMessage(error));
    } finally {
      setForzandoSync(false);
    }
  };

  const handleDesconectar = async (): Promise<void> => {
    setDesconectando(true);
    setMensajeAccion('');
    try {
      await wooService.desconectarWooCommerce();
      setConectado(false);
      setEstadoWoo(null);
      setConfirmandoDesconexion(false);
      setEstadoVerificacion('idle');
      setMensajeVerificacion('');
      onDesconectado();
      setMensajeAccion('WooCommerce desconectado');
    } catch (error) {
      setMensajeAccion(errorMessage(error));
    } finally {
      setDesconectando(false);
    }
  };

  const ultimaSync = estadoWoo?.ultima_sync ?? estadoWoo?.ultima_sincronizacion ?? null;
  const jobsActivos =
    typeof estadoWoo?.jobs_activos === 'boolean' ? estadoWoo.jobs_activos : false;

  const messageStyle = (type: EstadoVerificacion): CSSProperties => {
    if (type === 'error') return { color: TOKENS.danger };
    if (type === 'success') return { color: TOKENS.accent };
    return { color: TOKENS.textMid };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.74)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: TOKENS.font,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 12,
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.surface,
          color: TOKENS.text,
          boxShadow: '0 28px 70px rgba(0,0,0,0.56)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 18px 14px',
            borderBottom: `1px solid ${TOKENS.border}`,
            background: `linear-gradient(180deg, ${TOKENS.surface2} 0%, ${TOKENS.surface} 100%)`,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <WooLogo />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {conectado ? 'WooCommerce Conectado' : 'Conectar WooCommerce'}
                </h2>
                {conectado && (
                  <span
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${TOKENS.accent}55`,
                      background: `${TOKENS.accent}1f`,
                      color: TOKENS.accent,
                      padding: '3px 8px',
                      fontFamily: TOKENS.fontMono,
                      fontSize: 10,
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                    }}
                  >
                    ACTIVO
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: TOKENS.textMid }}>
                {conectado
                  ? 'Tu tienda está vinculada al sistema'
                  : 'Sincroniza tu tienda con el sistema'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${TOKENS.border2}`,
              background: TOKENS.surface2,
              color: TOKENS.textMid,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: '18px',
            }}
          >
            ×
          </button>
        </div>

        {cargandoEstado ? (
          <div style={{ padding: 20, color: TOKENS.textMid, fontSize: 13 }}>Cargando estado...</div>
        ) : !conectado ? (
          <div style={{ padding: 18 }}>
            <div
              style={{
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.bg,
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                fontSize: 12,
                color: TOKENS.textMid,
                lineHeight: 1.45,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: TOKENS.text }}>Paso 1:</strong> Ve a WooCommerce - Ajustes
                - Avanzado - REST API
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: TOKENS.text }}>Paso 2:</strong> Crea una clave con permisos
                Lectura/Escritura
              </div>
              <div>
                <strong style={{ color: TOKENS.text }}>Paso 3:</strong> Copia la URL, Consumer Key
                y Consumer Secret
              </div>
            </div>

            <form onSubmit={handleConectar} style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>URL de tu tienda</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://tutienda.com"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    border: `1px solid ${TOKENS.border2}`,
                    background: TOKENS.surface2,
                    color: TOKENS.text,
                    padding: '0 12px',
                    fontSize: 13,
                    fontFamily: TOKENS.font,
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>Consumer Key</span>
                <input
                  type="text"
                  value={consumerKey}
                  onChange={(event) => setConsumerKey(event.target.value)}
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    border: `1px solid ${TOKENS.border2}`,
                    background: TOKENS.surface2,
                    color: TOKENS.text,
                    padding: '0 12px',
                    fontSize: 13,
                    fontFamily: TOKENS.fontMono,
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>Consumer Secret</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 8,
                    border: `1px solid ${TOKENS.border2}`,
                    background: TOKENS.surface2,
                    overflow: 'hidden',
                  }}
                >
                  <input
                    type={mostrarSecret ? 'text' : 'password'}
                    value={consumerSecret}
                    onChange={(event) => setConsumerSecret(event.target.value)}
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                    style={{
                      flex: 1,
                      height: 40,
                      border: 'none',
                      background: 'transparent',
                      color: TOKENS.text,
                      padding: '0 12px',
                      fontSize: 13,
                      fontFamily: TOKENS.fontMono,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSecret((prev) => !prev)}
                    style={{
                      width: 50,
                      height: 40,
                      border: 'none',
                      borderLeft: `1px solid ${TOKENS.border2}`,
                      background: 'transparent',
                      color: TOKENS.textMid,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: TOKENS.fontMono,
                    }}
                  >
                    {mostrarSecret ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </label>

              {estadoVerificacion !== 'idle' && (
                <div style={{ fontSize: 12, ...messageStyle(estadoVerificacion) }}>
                  {mensajeVerificacion}
                </div>
              )}

              <button
                type="submit"
                disabled={estadoVerificacion === 'loading'}
                style={{
                  marginTop: 4,
                  height: 42,
                  borderRadius: 8,
                  border: `1px solid ${TOKENS.accent}44`,
                  background: `${TOKENS.accent}20`,
                  color: TOKENS.accent,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: TOKENS.font,
                }}
              >
                {estadoVerificacion === 'loading' ? 'Conectando...' : 'Verificar y Conectar'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <div
              style={{
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.bg,
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>URL:</span>
                <span style={{ fontSize: 11, color: TOKENS.text, fontFamily: TOKENS.fontMono }}>
                  {(estadoWoo?.url ?? normalizeUrl(url)) || '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>Última sync:</span>
                <span style={{ fontSize: 11, color: TOKENS.text, fontFamily: TOKENS.fontMono }}>
                  {formatFecha(ultimaSync)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>Productos sync:</span>
                <span style={{ fontSize: 11, color: TOKENS.text, fontFamily: TOKENS.fontMono }}>
                  {typeof estadoWoo?.productos_sync === 'number' ? estadoWoo.productos_sync : 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, color: TOKENS.textMid }}>Estado Redis/Jobs:</span>
                <span
                  style={{
                    fontSize: 11,
                    color: jobsActivos ? TOKENS.accent : '#f59e0b',
                    fontFamily: TOKENS.fontMono,
                  }}
                >
                  {jobsActivos ? '✅ Jobs activos' : '⚠️ Jobs inactivos'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={handleForzarSync}
                disabled={forzandoSync}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${TOKENS.accent}44`,
                  background: `${TOKENS.accent}20`,
                  color: TOKENS.accent,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: TOKENS.font,
                }}
              >
                {forzandoSync ? 'Sincronizando...' : '🔄 Forzar Sincronización Ahora'}
              </button>

              <button
                type="button"
                onClick={() => setConfirmandoDesconexion(true)}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${TOKENS.danger}55`,
                  background: `${TOKENS.danger}1b`,
                  color: TOKENS.danger,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: TOKENS.font,
                }}
              >
                Desconectar WooCommerce
              </button>
            </div>

            {confirmandoDesconexion && (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 10,
                  border: `1px solid ${TOKENS.danger}33`,
                  background: '#1a0b0b',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#fecaca', marginBottom: 10 }}>
                  ¿Estás seguro? Se perderá la configuración.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDesconexion(false)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${TOKENS.border2}`,
                      background: TOKENS.surface2,
                      color: TOKENS.textMid,
                      cursor: 'pointer',
                      padding: '0 10px',
                      fontFamily: TOKENS.font,
                      fontSize: 12,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDesconectar}
                    disabled={desconectando}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${TOKENS.danger}66`,
                      background: `${TOKENS.danger}22`,
                      color: TOKENS.danger,
                      cursor: 'pointer',
                      padding: '0 10px',
                      fontFamily: TOKENS.font,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {desconectando ? 'Desconectando...' : 'Sí, desconectar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {mensajeAccion && (
          <div
            style={{
              borderTop: `1px solid ${TOKENS.border}`,
              padding: '10px 18px',
              fontSize: 12,
              color: mensajeAccion.toLowerCase().includes('error') ? TOKENS.danger : TOKENS.textMid,
              background: TOKENS.surface2,
            }}
          >
            {mensajeAccion}
          </div>
        )}
      </div>
    </div>
  );
}

export default WooCommerceModal;
