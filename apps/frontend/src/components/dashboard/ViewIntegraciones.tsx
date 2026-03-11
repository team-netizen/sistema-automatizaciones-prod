// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { BASE_URL } from '../../lib/api';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const T = {
  bg: '#07090b',
  surface: '#0b0f12',
  surface2: '#0f1419',
  border: '#151d24',
  border2: '#1c2830',
  accent: '#00e87b',
  text: '#e8f5ee',
  textMid: '#4d6b58',
  textDim: '#2a3f30',
  font: 'DM Sans',
  fontMono: 'DM Mono',
};

const INTEGRACIONES_DISPONIBLES = [
  {
    tipo: 'woocommerce',
    nombre: 'WooCommerce',
    descripcion: 'Sincroniza productos y pedidos con tu tienda WordPress',
    icono: '🛒',
    color: '#7c3aed',
    campos: [
      {
        key: 'url',
        label: 'URL de la tienda',
        placeholder: 'https://mitienda.com',
        type: 'text',
      },
      {
        key: 'consumer_key',
        label: 'Consumer Key',
        placeholder: 'ck_...',
        type: 'text',
      },
      {
        key: 'consumer_secret',
        label: 'Consumer Secret',
        placeholder: 'cs_...',
        type: 'password',
      },
    ],
  },
  {
    tipo: 'mercadolibre',
    nombre: 'Mercado Libre',
    descripcion: 'Sincroniza publicaciones y pedidos de Mercado Libre',
    icono: '🛍️',
    color: '#ffe600',
    campos: [
      {
        key: 'app_id',
        label: 'App ID',
        placeholder: 'Ej: 1471731808551072',
        type: 'text',
      },
      {
        key: 'client_secret',
        label: 'Client Secret',
        placeholder: 'Tu client secret de ML',
        type: 'password',
      },
      {
        key: 'redirect_uri',
        label: 'Redirect URI',
        placeholder: 'https://...onrender.com/api/integraciones/mercadolibre/callback',
        type: 'text',
      },
    ],
    nota: 'Necesitas crear una aplicacion en developers.mercadolibre.com',
  },
  {
    tipo: 'shopify',
    nombre: 'Shopify',
    descripcion: 'Sincroniza productos y pedidos con tu tienda Shopify',
    icono: '🏪',
    color: '#96bf48',
    campos: [
      {
        key: 'shop_url',
        label: 'URL de la tienda',
        placeholder: 'Ej: mitienda.myshopify.com',
        type: 'text',
      },
      {
        key: 'api_key',
        label: 'API Key',
        placeholder: 'Tu API Key de Shopify',
        type: 'text',
      },
      {
        key: 'api_secret',
        label: 'API Secret',
        placeholder: 'Tu API Secret de Shopify',
        type: 'password',
      },
    ],
    nota: 'La conexion se completa con OAuth despues de guardar credenciales.',
  },
  {
    tipo: 'whatsapp',
    nombre: 'WhatsApp Business',
    descripcion: 'Recibe y procesa pedidos automaticamente por WhatsApp',
    icono: '💬',
    color: '#25d366',
    campos: [
      {
        key: 'phone_number_id',
        label: 'Phone Number ID',
        placeholder: 'ID del numero de WhatsApp',
        type: 'text',
      },
      {
        key: 'access_token',
        label: 'Access Token',
        placeholder: 'Token de acceso permanente',
        type: 'password',
      },
      {
        key: 'verify_token',
        label: 'Webhook Verify Token',
        placeholder: 'Token para verificar webhook',
        type: 'text',
      },
    ],
    nota: 'Requiere cuenta verificada en Meta Business Manager',
  },
];

const inputStyle = {
  width: '100%',
  background: T.bg,
  border: `1px solid ${T.border2}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: T.text,
  fontSize: 13,
  fontFamily: T.fontMono,
  outline: 'none',
};

const btnBase = {
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: T.font,
};

type IntegracionesService = typeof operacionesService & {
  conectarIntegracion?: (data: {
    tipo: string;
    credenciales: Record<string, string>;
    modo: 'conectar' | 'configurar';
  }) => Promise<any>;
  guardarCredencialesShopify?: (data: {
    empresa_id?: string;
    shop_url: string;
    api_key: string;
    api_secret: string;
  }) => Promise<any>;
  desconectarIntegracion?: (tipo: string) => Promise<any>;
  syncManualIntegracion?: (tipo: string) => Promise<any>;
};

const service = operacionesService as IntegracionesService;

interface ViewIntegracionesProps {
  usuario?: any;
}

const formatFecha = (raw?: string | null) => {
  if (!raw) return 'Nunca';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return date.toLocaleString('es-PE');
};

const getResumen = (integracion: any, tipo: string) => {
  const cred = integracion?.credenciales || {};
  if (tipo === 'woocommerce') return cred?.url || null;
  if (tipo === 'shopify') return cred?.shop_url || null;
  if (tipo === 'mercadolibre') return cred?.app_id ? `App ID: ${cred.app_id}` : null;
  if (tipo === 'whatsapp') return cred?.phone_number_id ? `Phone ID: ${cred.phone_number_id}` : null;
  return null;
};

const getCredencialesIniciales = (tipo: string): Record<string, string> => {
  if (tipo === 'mercadolibre') {
    return { app_id: '', client_secret: '', redirect_uri: '' };
  }
  if (tipo === 'shopify') {
    return { shop_url: '', api_key: '', api_secret: '' };
  }
  if (tipo === 'whatsapp') {
    return { phone_number_id: '', access_token: '', verify_token: '' };
  }
  return {};
};

const normalizarCredenciales = (credenciales: unknown): Record<string, string> => {
  if (!credenciales || typeof credenciales !== 'object') return {};

  return Object.entries(credenciales as Record<string, unknown>).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value == null ? '' : String(value),
    }),
    {} as Record<string, string>,
  );
};

export const ViewIntegraciones = ({ usuario }: ViewIntegracionesProps) => {
  const [integraciones, setIntegraciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTipo, setModalTipo] = useState<string | null>(null);
  const [modalModo, setModalModo] = useState<'conectar' | 'configurar'>('conectar');
  const [credenciales, setCredenciales] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmDesconectar, setConfirmDesconectar] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<Record<string, boolean>>({});
  const [oauthMlListo, setOauthMlListo] = useState(false);
  const [authUrlMl, setAuthUrlMl] = useState('');
  const [oauthShopifyListo, setOauthShopifyListo] = useState(false);
  const [authUrlShopify, setAuthUrlShopify] = useState('');
  const [esperandoOauthShopify, setEsperandoOauthShopify] = useState(false);
  const oauthMlMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const oauthMlPopupCheckIntervalRef = useRef<number | null>(null);
  const oauthShopifyMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const oauthShopifyPopupCheckIntervalRef = useRef<number | null>(null);

  const empresaId = String(usuario?.empresa_id || '');
  const backendBase = (BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/+$/,
    '',
  );

  const cargarIntegraciones = async () => {
    try {
      const data = await operacionesService.getIntegraciones();
      setIntegraciones(Array.isArray(data) ? data : data?.integraciones || []);
    } catch {
      setIntegraciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarIntegraciones();
    return () => {
      limpiarEscuchaOauthMl();
      limpiarEscuchaOauthShopify();
    };
  }, []);

  const getIntegracionActiva = (tipo: string) =>
    integraciones.find((i) => i.tipo_integracion === tipo && i.activa);

  const modalData = useMemo(
    () => INTEGRACIONES_DISPONIBLES.find((item) => item.tipo === modalTipo) || null,
    [modalTipo],
  );
  const desactivarAutocomplete = modalTipo === 'mercadolibre' || modalTipo === 'shopify' || modalTipo === 'whatsapp';

  const oauthMlUrl = useMemo(() => {
    if (modalTipo !== 'mercadolibre') return '';
    if (!credenciales.app_id || !credenciales.redirect_uri) return '';
    const base = 'https://auth.mercadolibre.com/authorization';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: credenciales.app_id,
      redirect_uri: credenciales.redirect_uri,
      state: empresaId,
    });
    return `${base}?${params.toString()}`;
  }, [modalTipo, credenciales.app_id, credenciales.redirect_uri, empresaId]);
  const oauthMlUrlFinal = authUrlMl || oauthMlUrl;
  const oauthShopifyUrlFinal = authUrlShopify;
  const mostrarSoloAutorizacionMl = modalTipo === 'mercadolibre' && Boolean(authUrlMl);
  const mostrarSoloAutorizacionShopify = modalTipo === 'shopify' && Boolean(authUrlShopify);
  const mostrarSoloAutorizacion = mostrarSoloAutorizacionMl || mostrarSoloAutorizacionShopify;

  const limpiarEscuchaOauthMl = () => {
    if (oauthMlMessageHandlerRef.current) {
      window.removeEventListener('message', oauthMlMessageHandlerRef.current);
      oauthMlMessageHandlerRef.current = null;
    }

    if (oauthMlPopupCheckIntervalRef.current !== null) {
      window.clearInterval(oauthMlPopupCheckIntervalRef.current);
      oauthMlPopupCheckIntervalRef.current = null;
    }
  };

  const limpiarEscuchaOauthShopify = () => {
    if (oauthShopifyMessageHandlerRef.current) {
      window.removeEventListener('message', oauthShopifyMessageHandlerRef.current);
      oauthShopifyMessageHandlerRef.current = null;
    }

    if (oauthShopifyPopupCheckIntervalRef.current !== null) {
      window.clearInterval(oauthShopifyPopupCheckIntervalRef.current);
      oauthShopifyPopupCheckIntervalRef.current = null;
    }
  };

  const cerrarModal = () => {
    limpiarEscuchaOauthMl();
    limpiarEscuchaOauthShopify();
    setAuthUrlMl('');
    setAuthUrlShopify('');
    setCredenciales({});
    setError('');
    setOauthMlListo(false);
    setOauthShopifyListo(false);
    setEsperandoOauthShopify(false);
    setModalTipo(null);
  };

  const handleAutorizarML = () => {
    if (!oauthMlUrlFinal) {
      setError('No se pudo generar la URL de autorizacion de Mercado Libre');
      return;
    }

    const popup = window.open(oauthMlUrlFinal, '_blank', 'width=600,height=700');
    if (!popup) {
      setError('El navegador bloqueo la ventana emergente. Habilita popups e intenta de nuevo.');
      return;
    }

    limpiarEscuchaOauthMl();
    const handleMessage = (event: MessageEvent) => {
      if (event.data !== 'ml-oauth-complete') return;
      limpiarEscuchaOauthMl();
      void (async () => {
        await cargarIntegraciones();
        cerrarModal();
      })();
    };

    oauthMlMessageHandlerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    oauthMlPopupCheckIntervalRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      limpiarEscuchaOauthMl();
      void (async () => {
        await cargarIntegraciones();
        cerrarModal();
      })();
    }, 1000);
  };

  const handleAutorizarShopify = (authUrlParam?: string) => {
    const finalUrl = authUrlParam || oauthShopifyUrlFinal;
    if (!finalUrl) {
      setError('No se pudo generar la URL de autorizacion de Shopify');
      return;
    }

    const popup = window.open(finalUrl, '_blank', 'width=600,height=700');
    if (!popup) {
      setEsperandoOauthShopify(false);
      setError('El navegador bloqueo la ventana emergente. Habilita popups e intenta de nuevo.');
      return;
    }

    setError('');
    setEsperandoOauthShopify(true);
    limpiarEscuchaOauthShopify();
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data !== 'shopify-oauth-complete'
        && event.data !== 'shopify-connected'
        && event.data !== 'shopify-error'
      ) {
        return;
      }

      limpiarEscuchaOauthShopify();

      if (event.data === 'shopify-error') {
        setEsperandoOauthShopify(false);
        setError('Error durante la autorizacion en Shopify. Intenta nuevamente.');
        return;
      }

      void (async () => {
        setEsperandoOauthShopify(false);
        await cargarIntegraciones();
        cerrarModal();
      })();
    };

    oauthShopifyMessageHandlerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    oauthShopifyPopupCheckIntervalRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      limpiarEscuchaOauthShopify();
      setEsperandoOauthShopify(false);
      setError('Autorizacion cancelada. Intenta nuevamente.');
    }, 1000);
  };

  const abrirModalConectar = (tipo: string) => {
    setModalTipo(tipo);
    setModalModo('conectar');
    setCredenciales(getCredencialesIniciales(tipo));
    setAuthUrlMl('');
    setAuthUrlShopify('');
    setError('');
    setOauthMlListo(false);
    setOauthShopifyListo(false);
    setEsperandoOauthShopify(false);
  };

  const abrirModalConfigurar = (tipo: string) => {
    const intActiva = getIntegracionActiva(tipo);
    const credencialesBase = getCredencialesIniciales(tipo);
    const credencialesGuardadas = normalizarCredenciales(intActiva?.credenciales);
    setModalTipo(tipo);
    setModalModo('configurar');
    setCredenciales({ ...credencialesBase, ...credencialesGuardadas });
    setAuthUrlMl('');
    setAuthUrlShopify('');
    setError('');
    setOauthMlListo(false);
    setOauthShopifyListo(false);
    setEsperandoOauthShopify(false);
    if (!intActiva) setError('Integracion no encontrada');
  };

  const guardarIntegracion = async () => {
    if (!modalTipo || !modalData) return;

    const camposVacios = modalData.campos.filter((campo) => !String(credenciales[campo.key] || '').trim());
    if (camposVacios.length > 0) {
      setError(`Completa: ${camposVacios.map((c) => c.label).join(', ')}`);
      return;
    }

    setGuardando(true);
    setError('');
    try {
      if (modalTipo === 'shopify') {
        if (!service.guardarCredencialesShopify) {
          throw new Error('Metodo guardarCredencialesShopify no disponible');
        }

        const respuestaShopify = await service.guardarCredencialesShopify({
          empresa_id: empresaId || undefined,
          shop_url: String(credenciales.shop_url || ''),
          api_key: String(credenciales.api_key || ''),
          api_secret: String(credenciales.api_secret || ''),
        });

        const authUrl = String(respuestaShopify?.auth_url || '');
        if (!authUrl) {
          throw new Error('No se pudo generar la URL de autorizacion de Shopify');
        }

        setAuthUrlShopify(authUrl);
        setOauthShopifyListo(true);
        handleAutorizarShopify(authUrl);
        return;
      }

      if (!service.conectarIntegracion) {
        throw new Error('Metodo conectarIntegracion no disponible');
      }

      const respuesta = await service.conectarIntegracion({
        tipo: modalTipo,
        credenciales,
        modo: modalModo,
      });

      await cargarIntegraciones();
      if (modalTipo === 'mercadolibre') {
        setAuthUrlMl(String(respuesta?.auth_url || ''));
        setOauthMlListo(true);
      } else {
        cerrarModal();
      }
    } catch (err: any) {
      setError(err?.message || 'Error al conectar');
    } finally {
      setGuardando(false);
    }
  };

  const desconectarIntegracion = async (tipo: string) => {
    try {
      if (!service.desconectarIntegracion) {
        throw new Error('Metodo desconectarIntegracion no disponible');
      }
      await service.desconectarIntegracion(tipo);
      await cargarIntegraciones();
    } catch (err: any) {
      alert(err?.message || 'Error al desconectar');
    } finally {
      setConfirmDesconectar(null);
    }
  };

  const handleSyncManual = async (tipo: string) => {
    setSincronizando((prev) => ({ ...prev, [tipo]: true }));
    try {
      if (!service.syncManualIntegracion) {
        throw new Error('Metodo syncManualIntegracion no disponible');
      }

      await service.syncManualIntegracion(tipo);
      alert(`Sincronizacion de ${tipo} iniciada correctamente`);
      await cargarIntegraciones();
    } catch (err: any) {
      alert(err?.message || `Error al sincronizar ${tipo}`);
    } finally {
      setSincronizando((prev) => ({ ...prev, [tipo]: false }));
    }
  };

  return (
    <div className="fade" style={{ color: T.text, fontFamily: T.font }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Integraciones</h2>
        <div style={{ marginTop: 4, fontSize: 12, color: T.textMid }}>
          Conecta tus canales de venta
        </div>
      </div>

      {loading && (
        <div
          style={{
            fontSize: 12,
            color: T.textMid,
            fontFamily: T.fontMono,
            marginBottom: 12,
          }}
        >
          Cargando integraciones...
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {INTEGRACIONES_DISPONIBLES.map((item) => {
          const integracionActiva = getIntegracionActiva(item.tipo);
          const conectada = Boolean(integracionActiva);
          const resumen = getResumen(integracionActiva, item.tipo);
          const permiteSyncManual = item.tipo === 'woocommerce' || item.tipo === 'mercadolibre';

          return (
            <div
              key={item.tipo}
              style={{
                background: T.surface,
                border: `1px solid ${conectada ? `${item.color}40` : T.border}`,
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                minHeight: 240,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>{item.icono}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{item.nombre}</div>
                  <div style={{ fontSize: 11, color: conectada ? item.color : T.textMid }}>
                    {conectada ? '● CONECTADO' : '○ DESCONECTADO'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5 }}>{item.descripcion}</div>

              {conectada && (
                <div
                  style={{
                    background: T.bg,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 11,
                    color: T.textMid,
                  }}
                >
                  {resumen && (
                    <div
                      style={{
                        marginBottom: 4,
                        fontFamily: T.fontMono,
                        color: T.text,
                        wordBreak: 'break-all',
                      }}
                    >
                      {resumen}
                    </div>
                  )}
                  <div>
                    Ultima sync: {formatFecha(integracionActiva?.ultima_sincronizacion)}
                  </div>
                  {integracionActiva?.webhook_url && (
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: T.fontMono,
                        fontSize: 10,
                        color: T.accent,
                        wordBreak: 'break-all',
                      }}
                    >
                      {integracionActiva.webhook_url}
                    </div>
                  )}
                </div>
              )}

              {item.nota && !conectada && (
                <div style={{ fontSize: 11, color: '#f59e0b', fontStyle: 'italic' }}>
                  ℹ️ {item.nota}
                </div>
              )}

              {conectada && permiteSyncManual && (
                <button
                  type="button"
                  onClick={() => void handleSyncManual(item.tipo)}
                  disabled={Boolean(sincronizando[item.tipo])}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: sincronizando[item.tipo] ? '#6b7280' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: sincronizando[item.tipo] ? 'not-allowed' : 'pointer',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {sincronizando[item.tipo] ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                {conectada ? (
                  <>
                    <button
                      type="button"
                      onClick={() => abrirModalConfigurar(item.tipo)}
                      style={{
                        ...btnBase,
                        flex: 1,
                        background: `${item.color}20`,
                        border: `1px solid ${item.color}40`,
                        color: item.color,
                      }}
                    >
                      ⚙️ Configurar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDesconectar(item.tipo)}
                      style={{
                        ...btnBase,
                        background: '#ef444420',
                        border: '1px solid #ef444440',
                        color: '#ef4444',
                      }}
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => abrirModalConectar(item.tipo)}
                    style={{
                      ...btnBase,
                      flex: 1,
                      background: T.accent,
                      border: 'none',
                      color: T.bg,
                    }}
                  >
                    + Conectar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalTipo && modalData && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!guardando && !esperandoOauthShopify) cerrarModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.74)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 18px',
                borderBottom: `1px solid ${T.border}`,
                background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)`,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {modalModo === 'conectar' ? 'Conectar' : 'Configurar'} {modalData.nombre}
              </div>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!mostrarSoloAutorizacion && modalData.campos.map((campo) => (
                <div key={campo.key}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: T.textMid,
                      marginBottom: 6,
                    }}
                  >
                    {campo.label}
                  </label>
                  <input
                    key={`${modalTipo || 'integracion'}-${modalModo}-${campo.key}`}
                    type={campo.type}
                    value={credenciales[campo.key] || ''}
                    onChange={(event) =>
                      setCredenciales((prev) => ({
                        ...prev,
                        [campo.key]: event.target.value,
                      }))
                    }
                    name={`integracion_${modalTipo || 'canal'}_${campo.key}`}
                    autoComplete={desactivarAutocomplete ? 'new-password' : undefined}
                    autoCorrect={desactivarAutocomplete ? 'off' : undefined}
                    autoCapitalize={desactivarAutocomplete ? 'off' : undefined}
                    spellCheck={desactivarAutocomplete ? false : undefined}
                    data-lpignore={desactivarAutocomplete ? 'true' : undefined}
                    placeholder={campo.placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}

              {modalTipo === 'whatsapp' && (
                <div
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.border2}`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                    URL del Webhook para configurar en Meta:
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.accent,
                      fontFamily: T.fontMono,
                      wordBreak: 'break-all',
                    }}
                  >
                    {backendBase}/api/integraciones/whatsapp/webhook/{empresaId || '{empresa_id}'}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${backendBase}/api/integraciones/whatsapp/webhook/${empresaId || '{empresa_id}'}`,
                      )
                    }
                    style={{
                      ...btnBase,
                      marginTop: 8,
                      background: T.surface2,
                      border: `1px solid ${T.border2}`,
                      color: T.textMid,
                    }}
                  >
                    Copiar
                  </button>
                </div>
              )}

              {modalTipo === 'shopify' && oauthShopifyListo && oauthShopifyUrlFinal && (
                <div
                  style={{
                    background: 'rgba(150,191,72,0.12)',
                    border: '1px solid rgba(150,191,72,0.5)',
                    borderRadius: 10,
                    padding: 16,
                    marginTop: 16,
                  }}
                >
                  <p
                    style={{
                      color: '#c4e086',
                      fontSize: 13,
                      margin: '0 0 12px',
                      fontWeight: 600,
                    }}
                  >
                    {esperandoOauthShopify
                      ? 'Esperando autorizacion en Shopify...'
                      : 'Credenciales guardadas. Si el popup no se abrio o lo cerraste, reintenta la autorizacion:'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAutorizarShopify()}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#96bf48',
                      color: '#0b0f12',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: esperandoOauthShopify ? 'not-allowed' : 'pointer',
                      opacity: esperandoOauthShopify ? 0.7 : 1,
                    }}
                    disabled={esperandoOauthShopify}
                  >
                    {esperandoOauthShopify ? 'Esperando autorizacion...' : 'Autorizar en Shopify'}
                  </button>
                  <p style={{ color: '#6b7280', fontSize: '11px', margin: '8px 0 0', textAlign: 'center' }}>
                    Se abrira una ventana emergente. Al autorizar, esta ventana se cerrara automaticamente.
                  </p>
                </div>
              )}

              {modalTipo === 'mercadolibre' && oauthMlListo && oauthMlUrlFinal && (
                <div
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid #6366f1',
                    borderRadius: 10,
                    padding: 16,
                    marginTop: 16,
                  }}
                >
                  <p
                    style={{
                      color: '#a5b4fc',
                      fontSize: 13,
                      margin: '0 0 12px',
                      fontWeight: 600,
                    }}
                  >
                    Credenciales guardadas. Ahora autoriza la app:
                  </p>
                  <button
                    type="button"
                    onClick={handleAutorizarML}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#ffe600',
                      color: '#333',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Autorizar en Mercado Libre
                  </button>
                  <p style={{ color: '#6b7280', fontSize: '11px', margin: '8px 0 0', textAlign: 'center' }}>
                    Se abrira una ventana emergente. Al autorizar, esta ventana se cerrara automaticamente.
                  </p>
                </div>
              )}

              {error && (
                <div
                  style={{
                    background: '#ef444418',
                    border: '1px solid #ef444440',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#ef4444',
                    fontSize: 12,
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: 16,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <button
                type="button"
                onClick={cerrarModal}
                style={{
                  ...btnBase,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  color: T.textMid,
                }}
                disabled={guardando || esperandoOauthShopify}
              >
                Cancelar
              </button>
              {!mostrarSoloAutorizacion && (
                <button
                  type="button"
                  onClick={() => void guardarIntegracion()}
                  style={{
                    ...btnBase,
                    background: T.accent,
                    border: 'none',
                    color: T.bg,
                    minWidth: 150,
                  }}
                  disabled={guardando || esperandoOauthShopify}
                >
                  {guardando ? 'Guardando...' : esperandoOauthShopify ? 'Esperando autorizacion...' : 'Guardar y Conectar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDesconectar && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDesconectar(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1410,
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              Desconectar integracion
            </div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 14 }}>
              Esta accion desactivara la integracion actual. Puedes volver a conectarla luego.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDesconectar(null)}
                style={{
                  ...btnBase,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  color: T.textMid,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void desconectarIntegracion(confirmDesconectar)}
                style={{
                  ...btnBase,
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                }}
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

