// @ts-nocheck
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ModalCambiarPassword from '../auth/ModalCambiarPassword';
import AlertasSucursal from './AlertasSucursal';
import { apiFetch } from '../../lib/api';

const T = {
  bg: '#020617',
  shell: '#0f172a',
  card: '#ffffff',
  cardMuted: '#f8fafc',
  border: '#e2e8f0',
  indigo: '#6366f1',
  indigoSoft: '#e0e7ff',
  text: '#0f172a',
  textMuted: '#64748b',
  success: '#15803d',
  successBg: '#dcfce7',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',
  slateBg: '#f1f5f9',
  shadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
};

const NAV = [
  ['dashboard', 'Dashboard'],
  ['empresas', 'Empresas'],
  ['usuarios', 'Usuarios'],
  ['planes', 'Planes'],
  ['metricas', 'Metricas'],
  ['sistema', 'Sistema'],
  ['alertas', 'Alertas'],
];

const box = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow };
const input = { border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 13, padding: '10px 12px' };
const cell = { borderTop: `1px solid ${T.border}`, fontSize: 13, padding: '14px' };
const head = { color: T.textMuted, fontSize: 11, fontWeight: 800, padding: '12px 14px', textAlign: 'left', textTransform: 'uppercase' };

function normalizeApiBase(apiBase) {
  return String(apiBase || '').replace(/\/+$/, '');
}

function formatDate(value, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function money(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
}

function metricValue(metricas, ...keys) {
  for (const key of keys) {
    if (metricas?.[key] !== undefined && metricas?.[key] !== null) {
      return metricas[key];
    }
  }
  return undefined;
}

function badge(estado) {
  const key = String(estado || '').toLowerCase();
  if (key === 'activo' || key === 'activa') return { bg: T.successBg, color: T.success, label: 'Activo' };
  if (key === 'suspendido' || key === 'suspendida') return { bg: T.dangerBg, color: T.danger, label: 'Suspendido' };
  return { bg: T.slateBg, color: T.textMuted, label: estado || 'Inactivo' };
}

function Modal({ open, title, children, onClose, width = 720 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ alignItems: 'center', background: 'rgba(2, 6, 23, 0.52)', display: 'flex', inset: 0, justifyContent: 'center', padding: 20, position: 'fixed', zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 20, boxShadow: '0 30px 80px rgba(2, 6, 23, 0.28)', maxHeight: '88vh', maxWidth: '96vw', overflowY: 'auto', width }}>
        <div style={{ alignItems: 'center', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', padding: '18px 22px' }}>
          <h3 style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 22 }} type="button">×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

export function SuperAdminDashboard({ usuario, token, apiBase, onLogout }) {
  const apiRoot = `${normalizeApiBase(apiBase)}/api/super-admin`;
  const [nav, setNav] = useState('dashboard');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [empresasTotal, setEmpresasTotal] = useState(0);
  const [empresasPage, setEmpresasPage] = useState(1);
  const [empresaSearch, setEmpresaSearch] = useState('');
  const [empresaDetalle, setEmpresaDetalle] = useState(null);
  const [modalCrearEmpresa, setModalCrearEmpresa] = useState(false);
  const [creandoEmpresa, setCreandoEmpresa] = useState(false);
  const [modalEditarEmpresa, setModalEditarEmpresa] = useState(false);
  const [editandoEmpresa, setEditandoEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '',
    ruc: '',
    adminEmail: '',
    adminPassword: '',
    planId: '',
  });
  const [formEditar, setFormEditar] = useState({
    id: '',
    nombre: '',
    ruc: '',
    estado: 'activo',
    planId: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [usuarios, setUsuarios] = useState([]);
  const [modalEditarUsuario, setModalEditarUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    id: '',
    email: '',
    password: '',
    rol: '',
    empresa_id: '',
    sucursal_id: '',
    empresa_nombre: '',
    sucursal_nombre: '',
  });
  const [usuarioRol, setUsuarioRol] = useState('');
  const [usuarioEmpresaId, setUsuarioEmpresaId] = useState('');
  const [usuarioSearch, setUsuarioSearch] = useState('');
  const [planes, setPlanes] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [empresasLista, setEmpresasLista] = useState([]);
  const [metricasMes, setMetricasMes] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [empresaFiltro, setEmpresaFiltro] = useState('todas');
  const [rangoFecha, setRangoFecha] = useState({
    desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0],
  });
  const [modoRango, setModoRango] = useState('mes');
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [metricas, setMetricas] = useState(null);
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [modulos, setModulos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [auditoriaTotal, setAuditoriaTotal] = useState(0);
  const [auditoriaPage, setAuditoriaPage] = useState(1);
  const [auditoriaEmpresaId, setAuditoriaEmpresaId] = useState('');
  const [auditoriaTipoAccion, setAuditoriaTipoAccion] = useState('');
  const [auditoriaDetalle, setAuditoriaDetalle] = useState(null);
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ nombre: '', precio: '0', maximo_usuarios: '0', limite_tokens_mensual: '0', limite_ejecuciones_mensual: '0' });
  const [subscriptionForm, setSubscriptionForm] = useState({ empresa_id: '', plan_id: '', fecha_inicio: '', fecha_fin: '' });

  useEffect(() => {
    const usuarioSesion = JSON.parse(sessionStorage.getItem('usuario') ?? '{}');
    if (usuarioSesion.must_change_password) {
      setMostrarModalPassword(true);
    }
  }, []);

  const request = async (path, init) => {
    const response = await apiFetch(`${apiRoot}/${path}`, init);
    if (!response.ok) {
      let message = 'No se pudo completar la solicitud.';
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        // noop
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  };

  const loadDashboard = async () => setDashboard(await request('dashboard-resumen'));
  const loadCompanyOptions = async () => {
    const payload = await request('empresas?page=1&limit=100');
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const options = rows.map((row) => ({ id: row.id, nombre: row.nombre }));
    setCompanyOptions(options);
    setEmpresasLista(options);
  };
  const loadEmpresas = async () => {
    const params = new URLSearchParams({ page: String(empresasPage), limit: '10' });
    if (empresaSearch.trim()) params.set('q', empresaSearch.trim());
    const payload = await request(`empresas?${params.toString()}`);
    setEmpresas(Array.isArray(payload?.rows) ? payload.rows : []);
    setEmpresasTotal(Number(payload?.total || 0));
  };
  const loadUsuarios = async () => {
    const params = new URLSearchParams();
    if (usuarioRol) params.set('rol', usuarioRol);
    if (usuarioEmpresaId) params.set('empresaId', usuarioEmpresaId);
    if (usuarioSearch.trim()) params.set('q', usuarioSearch.trim());
    setUsuarios((await request(`usuarios?${params.toString()}`)) || []);
  };
  const loadPlanes = async () => setPlanes((await request('planes')) || []);
  const loadMetricas = async (desde, hasta) => {
    setLoadingMetricas(true);
    try {
      const params = new URLSearchParams();
      if (desde && hasta) {
        params.set('desde', desde);
        params.set('hasta', hasta);
      } else {
        params.set('mes', metricasMes);
      }
      if (empresaFiltro !== 'todas') {
        params.set('empresaId', empresaFiltro);
      }
      setMetricas(await request(`metricas?${params.toString()}`));
    } finally {
      setLoadingMetricas(false);
    }
  };
  const loadSistema = async () => {
    const params = new URLSearchParams({ page: String(auditoriaPage), limit: '10' });
    if (auditoriaEmpresaId) params.set('empresaId', auditoriaEmpresaId);
    if (auditoriaTipoAccion.trim()) params.set('tipoAccion', auditoriaTipoAccion.trim());
    const [mods, audit] = await Promise.all([request('modulos'), request(`auditoria?${params.toString()}`)]);
    setModulos(Array.isArray(mods) ? mods : []);
    setAuditoria(Array.isArray(audit?.rows) ? audit.rows : []);
    setAuditoriaTotal(Number(audit?.total || 0));
  };

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await Promise.all([loadDashboard(), loadCompanyOptions(), loadPlanes()]);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard.');
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (nav === 'dashboard') await loadDashboard();
        if (nav === 'empresas') await loadEmpresas();
        if (nav === 'usuarios') await loadUsuarios();
        if (nav === 'planes') await loadPlanes();
        if (nav === 'metricas') await loadMetricas(modoRango === 'personalizado' ? rangoFecha.desde : undefined, modoRango === 'personalizado' ? rangoFecha.hasta : undefined);
        if (nav === 'sistema') await loadSistema();
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la sección.');
      } finally {
        setLoading(false);
      }
    };
    if (nav !== 'alertas') void run();
  }, [nav, empresasPage, empresaSearch, usuarioRol, usuarioEmpresaId, usuarioSearch, auditoriaPage, auditoriaEmpresaId, auditoriaTipoAccion]);

  useEffect(() => {
    if (nav !== 'metricas') return;
    if (modoRango === 'mes') {
      void loadMetricas();
      return;
    }
    void loadMetricas(rangoFecha.desde, rangoFecha.hasta);
  }, [empresaFiltro, metricasMes, modoRango, nav]);

  const savePlan = async () => {
    const body = JSON.stringify({
      nombre: planForm.nombre.trim(),
      precio: Number(planForm.precio || 0),
      maximo_usuarios: Number(planForm.maximo_usuarios || 0),
      limite_tokens_mensual: Number(planForm.limite_tokens_mensual || 0),
      limite_ejecuciones_mensual: Number(planForm.limite_ejecuciones_mensual || 0),
    });
    await request(editingPlan ? `planes/${editingPlan.id}` : 'planes', { method: editingPlan ? 'PUT' : 'POST', body });
    setPlanModal(false);
    await loadPlanes();
  };

  const handleCambiarEstado = async (empresaId, nuevoEstado) => {
    try {
      await request(`empresas/${empresaId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      setEmpresas((prev) =>
        prev.map((empresa) => (empresa.id === empresaId ? { ...empresa, estado: nuevoEstado } : empresa)),
      );

      if (empresaDetalle?.empresa?.id === empresaId) {
        setEmpresaDetalle((prev) =>
          prev ? { ...prev, empresa: { ...prev.empresa, estado: nuevoEstado } } : prev,
        );
      }

      void loadDashboard();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error de conexion');
    }
  };

  const handleCrearEmpresa = async () => {
    if (!formEmpresa.nombre || !formEmpresa.ruc || !formEmpresa.adminEmail || !formEmpresa.adminPassword || !formEmpresa.planId) return;
    if (formEmpresa.ruc.length !== 11) {
      window.alert('El RUC debe tener 11 digitos');
      return;
    }
    if (formEmpresa.adminPassword.length < 6) {
      window.alert('La contrasena temporal debe tener al menos 6 caracteres');
      return;
    }

    setCreandoEmpresa(true);
    try {
      const nueva = await request('empresas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: formEmpresa.nombre,
          ruc: formEmpresa.ruc,
          adminEmail: formEmpresa.adminEmail,
          adminPassword: formEmpresa.adminPassword,
          planId: formEmpresa.planId,
        }),
      });

      setEmpresas((prev) => [nueva, ...prev]);
      setEmpresasTotal((prev) => prev + 1);
      setCompanyOptions((prev) => [{ id: nueva.id, nombre: nueva.nombre }, ...prev]);
      setEmpresasLista((prev) => [{ id: nueva.id, nombre: nueva.nombre }, ...prev]);
      setFormEmpresa({ nombre: '', ruc: '', adminEmail: '', adminPassword: '', planId: '' });
      setModalCrearEmpresa(false);
      void loadDashboard();
      window.alert(`Empresa "${nueva.nombre}" creada correctamente`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setCreandoEmpresa(false);
    }
  };

  const handleAbrirEditar = async (empresa) => {
    setFormEditar({
      id: empresa.id || '',
      nombre: empresa.nombre || '',
      ruc: empresa.ruc || '',
      estado: empresa.estado || 'activo',
      planId: empresa.plan_id || '',
      adminEmail: '',
      adminPassword: '',
    });
    setModalEditarEmpresa(true);

    try {
      const admin = await request(`empresas/${empresa.id}/admin`);
      setFormEditar((prev) => ({
        ...prev,
        adminEmail: admin?.email || '',
      }));
    } catch {
      // noop
    }
  };

  const closeEditarEmpresaModal = () => {
    setModalEditarEmpresa(false);
    setFormEditar({
      id: '',
      nombre: '',
      ruc: '',
      estado: 'activo',
      planId: '',
      adminEmail: '',
      adminPassword: '',
    });
  };

  const handleGuardarEdicion = async () => {
    if (!formEditar.nombre || !formEditar.ruc) return;
    if (formEditar.ruc.length !== 11) {
      window.alert('El RUC debe tener 11 digitos');
      return;
    }

    setEditandoEmpresa(true);
    try {
      const actualizada = await request(`empresas/${formEditar.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: formEditar.nombre,
          ruc: formEditar.ruc,
          estado: formEditar.estado,
          planId: formEditar.planId,
          adminEmail: formEditar.adminEmail,
          adminPassword: formEditar.adminPassword || undefined,
        }),
      });

      setEmpresas((prev) =>
        prev.map((empresa) =>
          empresa.id === formEditar.id
            ? {
                ...empresa,
                ...actualizada,
              }
            : empresa,
        ),
      );
      setCompanyOptions((prev) =>
        prev.map((empresa) =>
          empresa.id === formEditar.id ? { ...empresa, nombre: formEditar.nombre } : empresa,
        ),
      );
      setEmpresasLista((prev) =>
        prev.map((empresa) =>
          empresa.id === formEditar.id ? { ...empresa, nombre: formEditar.nombre } : empresa,
        ),
      );

      if (empresaDetalle?.empresa?.id === formEditar.id) {
        setEmpresaDetalle((prev) =>
          prev
            ? {
                ...prev,
                empresa: {
                  ...prev.empresa,
                  nombre: actualizada?.nombre ?? formEditar.nombre,
                  ruc: actualizada?.ruc ?? formEditar.ruc,
                  estado: actualizada?.estado ?? formEditar.estado,
                },
                suscripcion_actual: prev.suscripcion_actual
                  ? {
                      ...prev.suscripcion_actual,
                      plan_id: actualizada?.plan_id ?? prev.suscripcion_actual.plan_id,
                      plan: prev.suscripcion_actual.plan
                        ? {
                            ...prev.suscripcion_actual.plan,
                            id: actualizada?.plan_id ?? prev.suscripcion_actual.plan.id,
                            nombre: actualizada?.plan_activo ?? prev.suscripcion_actual.plan.nombre,
                          }
                        : prev.suscripcion_actual.plan,
                    }
                  : prev.suscripcion_actual,
              }
            : prev,
        );
      }

      closeEditarEmpresaModal();
      void loadDashboard();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setEditandoEmpresa(false);
    }
  };

  const handleAbrirEditarUsuario = (usuario) => {
    setFormUsuario({
      id: usuario.id || '',
      email: usuario.email || '',
      password: '',
      rol: usuario.rol || '',
      empresa_id: usuario.empresa_id || '',
      sucursal_id: usuario.sucursal_id || '',
      empresa_nombre: usuario.empresa_nombre || usuario.empresa || '',
      sucursal_nombre: usuario.sucursal_nombre || usuario.sucursal || '-',
    });
    setModalEditarUsuario(true);
  };

  const closeEditarUsuarioModal = () => {
    setModalEditarUsuario(false);
    setFormUsuario({
      id: '',
      email: '',
      password: '',
      rol: '',
      empresa_id: '',
      sucursal_id: '',
      empresa_nombre: '',
      sucursal_nombre: '',
    });
  };

  const handleGuardarUsuario = async () => {
    if (!formUsuario.email) return;
    if (formUsuario.password && formUsuario.password.length < 6) {
      window.alert('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setEditandoUsuario(true);
    try {
      await request(`usuarios/${formUsuario.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: formUsuario.email,
          password: formUsuario.password || undefined,
          rol: formUsuario.rol,
        }),
      });

      setUsuarios((prev) =>
        prev.map((usuario) =>
          usuario.id === formUsuario.id
            ? {
                ...usuario,
                email: formUsuario.email,
                rol: formUsuario.rol,
              }
            : usuario,
        ),
      );
      closeEditarUsuarioModal();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setEditandoUsuario(false);
    }
  };

  const closeCrearEmpresaModal = () => {
    setModalCrearEmpresa(false);
    setFormEmpresa({ nombre: '', ruc: '', adminEmail: '', adminPassword: '', planId: '' });
  };

  const sectionTitle = {
    dashboard: 'Dashboard global',
    empresas: 'Empresas',
    usuarios: 'Usuarios',
    planes: 'Planes y suscripciones',
    metricas: 'Métricas',
    sistema: 'Sistema',
    alertas: 'Alertas',
  }[nav];

  return (
    <>
      <div style={{ background: T.bg, color: T.text, display: 'grid', gridTemplateColumns: '250px 1fr', height: '100vh', overflow: 'hidden' }}>
        <aside style={{ background: T.shell, borderRight: '1px solid rgba(148, 163, 184, 0.12)', color: '#e2e8f0', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: 22, width: 250 }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>SISAUTO</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Panel de control global</div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {NAV.map(([id, label]) => (
              <button key={id} onClick={() => setNav(id)} style={{ background: nav === id ? 'rgba(99, 102, 241, 0.16)' : 'transparent', border: `1px solid ${nav === id ? 'rgba(99, 102, 241, 0.28)' : 'transparent'}`, borderRadius: 14, color: nav === id ? '#fff' : '#cbd5e1', cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '12px 14px', textAlign: 'left' }} type="button">{label}</button>
            ))}
          </div>
          {onLogout && <button onClick={onLogout} style={{ background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: 14, color: '#fecaca', cursor: 'pointer', fontSize: 14, fontWeight: 700, marginTop: 'auto', padding: '12px 14px' }} type="button">Cerrar sesión</button>}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          <header style={{ alignItems: 'center', background: '#fff', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', padding: '18px 28px', position: 'sticky', top: 0, zIndex: 20 }}>
            <div>
              <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>SISAUTO / Super Admin</div>
              <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>{sectionTitle}</div>
            </div>
            <div style={{ alignItems: 'center', display: 'flex', gap: 16 }}>
              <div style={{ alignItems: 'center', background: T.indigoSoft, borderRadius: 999, color: T.indigo, display: 'flex', fontSize: 12, fontWeight: 900, gap: 8, padding: '8px 14px' }}><span>◆</span><span>SUPER ADMIN</span></div>
              <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
                <div style={{ alignItems: 'center', background: T.indigo, borderRadius: '50%', color: '#fff', display: 'flex', fontSize: 14, fontWeight: 900, height: 38, justifyContent: 'center', width: 38 }}>{(usuario.email || 'S').charAt(0).toUpperCase()}</div>
                <div style={{ textAlign: 'right' }}><div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{usuario.email}</div><div style={{ color: T.textMuted, fontSize: 11 }}>{usuario.rol}</div></div>
              </div>
            </div>
          </header>

          <div style={{ background: 'linear-gradient(180deg, #eef2ff 0%, #f8fafc 180px)', flex: 1, minHeight: 'calc(100vh - 77px)', padding: 28 }}>
            {error && <div style={{ background: T.dangerBg, border: '1px solid #fecaca', borderRadius: 12, color: T.danger, fontSize: 13, fontWeight: 700, marginBottom: 16, padding: '12px 14px' }}>{error}</div>}
            {loading && nav !== 'alertas' && <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 16 }}>Cargando datos...</div>}

            {nav === 'dashboard' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {[
                    ['Total empresas', dashboard?.kpis?.total_empresas || 0, 'Base total registrada'],
                    ['Empresas activas', dashboard?.kpis?.empresas_activas || 0, 'Con acceso habilitado'],
                    ['Suscripciones activas', dashboard?.kpis?.suscripciones_activas || 0, 'Planes en curso'],
                    ['Total usuarios', dashboard?.kpis?.total_usuarios || 0, 'Sin contar super admin'],
                  ].map(([label, value, hint]) => (
                    <div key={String(label)} style={{ ...box, padding: '18px 20px' }}>
                      <div style={{ color: T.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ color: T.text, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{value}</div>
                      <div style={{ color: T.textMuted, fontSize: 13, marginTop: 8 }}>{hint}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...box, overflow: 'hidden' }}>
                  <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 20px' }}><h3 style={{ margin: 0 }}>Ultimas empresas registradas</h3></div>
                  <div style={{ overflowX: 'auto', padding: 20 }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: 620, width: '100%' }}>
                      <thead><tr style={{ background: T.cardMuted }}>{['Nombre', 'RUC', 'Estado', 'Fecha creacion'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                      <tbody>{(dashboard?.ultimas_empresas || []).map((row) => { const state = badge(row.estado); return <tr key={row.id}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.nombre}</td><td style={{ ...cell, color: T.textMuted }}>{row.ruc}</td><td style={cell}><span style={{ background: state.bg, borderRadius: 999, color: state.color, fontSize: 12, fontWeight: 800, padding: '5px 10px' }}>{state.label}</span></td><td style={{ ...cell, color: T.textMuted }}>{formatDate(row.fecha_creacion, true)}</td></tr>; })}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {nav === 'empresas' && (
              <div style={{ ...box, overflow: 'hidden' }}>
                <div style={{ alignItems: 'center', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', padding: '18px 20px' }}>
                  <h3 style={{ margin: 0 }}>Empresas</h3>
                  <div style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
                    <input value={empresaSearch} onChange={(e) => { setEmpresasPage(1); setEmpresaSearch(e.target.value); }} placeholder="Buscar por nombre o RUC" style={{ ...input, width: 240 }} />
                    <button onClick={() => setModalCrearEmpresa(true)} style={{ background: T.indigo, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', whiteSpace: 'nowrap' }} type="button">+ Nueva empresa</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', padding: 20 }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: 980, width: '100%' }}>
                    <thead><tr style={{ background: T.cardMuted }}>{['Nombre', 'RUC', 'Estado', 'Plan activo', 'Usuarios', 'Fecha creacion', 'Acciones'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                    <tbody>{empresas.map((row) => { const state = badge(row.estado); return <tr key={row.id}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.nombre}</td><td style={{ ...cell, color: T.textMuted }}>{row.ruc}</td><td style={cell}><span style={{ background: state.bg, borderRadius: 999, color: state.color, fontSize: 12, fontWeight: 800, padding: '5px 10px' }}>{state.label}</span></td><td style={{ ...cell, color: T.text }}>{row.plan_activo}</td><td style={{ ...cell, color: T.textMuted }}>{row.usuarios}</td><td style={{ ...cell, color: T.textMuted }}>{formatDate(row.fecha_creacion)}</td><td style={cell}><div style={{ display: 'flex', gap: 8 }}><button onClick={() => handleAbrirEditar(row)} style={{ background: T.indigoSoft, border: 'none', borderRadius: 6, color: '#4338ca', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '6px 14px' }} type="button">Editar</button><button onClick={async () => setEmpresaDetalle(await request(`empresas/${row.id}/detalle`))} style={{ background: T.indigoSoft, border: 'none', borderRadius: 999, color: T.indigo, cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 12px' }} type="button">Ver detalle</button><button onClick={() => handleCambiarEstado(row.id, row.estado === 'activo' ? 'suspendido' : 'activo')} style={{ background: row.estado === 'activo' ? T.dangerBg : T.successBg, border: 'none', borderRadius: 999, color: row.estado === 'activo' ? T.danger : T.success, cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 12px' }} type="button">{row.estado === 'activo' ? 'Suspender' : 'Activar'}</button></div></td></tr>; })}</tbody>
                  </table>
                  <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                    <span style={{ color: T.textMuted, fontSize: 13 }}>Pagina {empresasPage} de {Math.max(1, Math.ceil(empresasTotal / 10))}</span>
                    <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setEmpresasPage((v) => Math.max(1, v - 1))} style={{ ...input, background: T.cardMuted, cursor: 'pointer' }} type="button">Anterior</button><button onClick={() => setEmpresasPage((v) => Math.min(Math.max(1, Math.ceil(empresasTotal / 10)), v + 1))} style={{ ...input, background: T.cardMuted, cursor: 'pointer' }} type="button">Siguiente</button></div>
                  </div>
                </div>
              </div>
            )}

            {nav === 'usuarios' && (
              <div style={{ ...box, overflow: 'hidden' }}>
                <div style={{ alignItems: 'center', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 10, justifyContent: 'space-between', padding: '18px 20px' }}>
                  <h3 style={{ margin: 0 }}>Usuarios globales</h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input value={usuarioSearch} onChange={(e) => setUsuarioSearch(e.target.value)} placeholder="Buscar por email" style={{ ...input, width: 220 }} />
                    <select value={usuarioRol} onChange={(e) => setUsuarioRol(e.target.value)} style={input}><option value="">Todos los roles</option><option value="admin_empresa">Admin empresa</option><option value="encargado_sucursal">Encargado</option><option value="vendedor">Vendedor</option></select>
                    <select value={usuarioEmpresaId} onChange={(e) => setUsuarioEmpresaId(e.target.value)} style={input}><option value="">Todas las empresas</option>{companyOptions.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}</select>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', padding: 20 }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: 920, width: '100%' }}>
                    <thead><tr style={{ background: T.cardMuted }}>{['Email', 'Rol', 'Empresa', 'Sucursal', 'Fecha creacion'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                    <tbody>{usuarios.map((row) => <tr key={row.id} onClick={() => handleAbrirEditarUsuario(row)} onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f6fa'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} style={{ cursor: 'pointer', transition: 'background 0.1s' }}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.email}</td><td style={{ ...cell, color: T.textMuted }}>{row.rol}</td><td style={{ ...cell, color: T.text }}>{row.empresa_nombre}</td><td style={{ ...cell, color: T.textMuted }}>{row.sucursal_nombre}</td><td style={{ ...cell, color: T.textMuted }}>{formatDate(row.fecha_creacion, true)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}

            {nav === 'planes' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ ...box, overflow: 'hidden' }}>
                  <div style={{ alignItems: 'center', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', padding: '18px 20px' }}>
                    <h3 style={{ margin: 0 }}>Planes</h3>
                    <button onClick={() => { setEditingPlan(null); setPlanForm({ nombre: '', precio: '0', maximo_usuarios: '0', limite_tokens_mensual: '0', limite_ejecuciones_mensual: '0' }); setPlanModal(true); }} style={{ background: T.indigo, border: 'none', borderRadius: 999, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '10px 14px' }} type="button">Crear plan</button>
                  </div>
                  <div style={{ overflowX: 'auto', padding: 20 }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: 980, width: '100%' }}>
                      <thead><tr style={{ background: T.cardMuted }}>{['Nombre', 'Precio', 'Max usuarios', 'Limite tokens', 'Limite ejecuciones', 'Empresas suscritas', 'Acciones'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                      <tbody>{planes.map((row) => <tr key={row.id}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.nombre}</td><td style={{ ...cell, color: T.text }}>{money(row.precio)}</td><td style={{ ...cell, color: T.textMuted }}>{row.maximo_usuarios}</td><td style={{ ...cell, color: T.textMuted }}>{row.limite_tokens_mensual}</td><td style={{ ...cell, color: T.textMuted }}>{row.limite_ejecuciones_mensual}</td><td style={{ ...cell, color: T.textMuted }}>{row.empresas_suscritas}</td><td style={cell}><button onClick={() => { setEditingPlan(row); setPlanForm({ nombre: row.nombre, precio: String(row.precio || 0), maximo_usuarios: String(row.maximo_usuarios || 0), limite_tokens_mensual: String(row.limite_tokens_mensual || 0), limite_ejecuciones_mensual: String(row.limite_ejecuciones_mensual || 0) }); setPlanModal(true); }} style={{ background: T.indigoSoft, border: 'none', borderRadius: 999, color: T.indigo, cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 12px' }} type="button">Editar</button></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
                <div style={{ ...box, padding: 20 }}>
                  <h3 style={{ marginTop: 0 }}>Asignar plan a empresa</h3>
                  <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <select value={subscriptionForm.empresa_id} onChange={(e) => setSubscriptionForm((v) => ({ ...v, empresa_id: e.target.value }))} style={input}><option value="">Selecciona empresa</option>{companyOptions.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}</select>
                    <select value={subscriptionForm.plan_id} onChange={(e) => setSubscriptionForm((v) => ({ ...v, plan_id: e.target.value }))} style={input}><option value="">Selecciona plan</option>{planes.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre}</option>)}</select>
                    <input type="date" value={subscriptionForm.fecha_inicio} onChange={(e) => setSubscriptionForm((v) => ({ ...v, fecha_inicio: e.target.value }))} style={input} />
                    <input type="date" value={subscriptionForm.fecha_fin} onChange={(e) => setSubscriptionForm((v) => ({ ...v, fecha_fin: e.target.value }))} style={input} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button onClick={async () => { await request('suscripciones', { method: 'POST', body: JSON.stringify(subscriptionForm) }); setSubscriptionForm({ empresa_id: '', plan_id: '', fecha_inicio: '', fecha_fin: '' }); await Promise.all([loadPlanes(), loadEmpresas(), loadDashboard()]); }} style={{ background: T.indigo, border: 'none', borderRadius: 999, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 16px' }} type="button">Asignar suscripcion</button></div>
                </div>
              </div>
            )}

            {nav === 'metricas' && (
              <div style={{ margin: '0 auto', maxWidth: '1200px', paddingBottom: '40px' }}>
                <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: 700, margin: 0 }}>Metricas globales</h2>
                    <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
                      {empresaFiltro === 'todas'
                        ? 'Vista consolidada de todas las empresas'
                        : `Mostrando datos de: ${empresasLista.find((empresa) => empresa.id === empresaFiltro)?.nombre ?? ''}`}
                    </p>
                  </div>
                  <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <label style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Empresa
                      </label>
                      <select
                        value={empresaFiltro}
                        onChange={(e) => setEmpresaFiltro(e.target.value)}
                        style={{ appearance: 'auto', background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '8px', color: '#1a1a2e', cursor: 'pointer', fontSize: '14px', minWidth: '180px', outline: 'none', padding: '8px 32px 8px 12px' }}
                      >
                        <option value="todas">Todas las empresas</option>
                        {empresasLista.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ background: '#f5f6fa', borderRadius: '8px', display: 'flex', padding: '3px' }}>
                      {['mes', 'personalizado'].map((modo) => (
                        <button
                          key={modo}
                          onClick={() => setModoRango(modo)}
                          style={{ background: modoRango === modo ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: modoRango === modo ? '#ffffff' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '6px 14px' }}
                          type="button"
                        >
                          {modo === 'mes' ? 'Por mes' : 'Personalizado'}
                        </button>
                      ))}
                    </div>

                    {modoRango === 'mes' && (
                      <input
                        type="month"
                        value={metricasMes}
                        onChange={(e) => {
                          setMetricasMes(e.target.value);
                          const [year, month] = e.target.value.split('-').map(Number);
                          const ultimoDia = new Date(year, month, 0).getDate();
                          setRangoFecha({
                            desde: `${e.target.value}-01`,
                            hasta: `${e.target.value}-${String(ultimoDia).padStart(2, '0')}`,
                          });
                        }}
                        style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '8px', color: '#1a1a2e', fontSize: '14px', outline: 'none', padding: '8px 12px' }}
                      />
                    )}

                    {modoRango === 'personalizado' && (
                      <div style={{ alignItems: 'center', display: 'flex', gap: '8px' }}>
                        <div>
                          <label style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>Desde</label>
                          <input type="date" value={rangoFecha.desde} onChange={(e) => setRangoFecha((prev) => ({ ...prev, desde: e.target.value }))} style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '8px', color: '#1a1a2e', fontSize: '14px', outline: 'none', padding: '8px 12px' }} />
                        </div>
                        <span style={{ color: '#6b7280', marginTop: '16px' }}>→</span>
                        <div>
                          <label style={{ color: '#6b7280', display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>Hasta</label>
                          <input type="date" value={rangoFecha.hasta} onChange={(e) => setRangoFecha((prev) => ({ ...prev, hasta: e.target.value }))} style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '8px', color: '#1a1a2e', fontSize: '14px', outline: 'none', padding: '8px 12px' }} />
                        </div>
                        <button onClick={() => void loadMetricas(rangoFecha.desde, rangoFecha.hasta)} style={{ background: '#6366f1', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '16px', padding: '8px 16px' }} type="button">Aplicar</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div style={{ ...box, padding: '18px 20px' }}><div style={{ color: T.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Total ventas del mes</div><div style={{ color: T.text, fontSize: 30, fontWeight: 900, marginTop: 8 }}>{money(metricas?.total_ventas_mes)}</div></div>
                  <div style={{ ...box, padding: '18px 20px' }}><div style={{ color: T.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Total pedidos del mes</div><div style={{ color: T.text, fontSize: 30, fontWeight: 900, marginTop: 8 }}>{Number(metricas?.total_pedidos_mes || 0)}</div></div>
                </div>
                {loadingMetricas && <div style={{ color: T.textMuted, fontSize: 13 }}>Cargando metricas...</div>}
                <div style={{ background: '#ffffff', border: '1.5px solid #e8ecf0', borderRadius: '14px', marginBottom: '16px', padding: '20px 22px' }}>
                  <h3 style={{ margin: '0 0 20px' }}>Ventas por dia</h3>
                  {(metricas?.graficaVentas || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={metricas.graficaVentas}>
                        <defs>
                          <linearGradient id="gradVentasSuperAdmin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                        <XAxis axisLine={false} dataKey="dia" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} />
                        <YAxis axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `S/${Number(value).toLocaleString()}`} tickLine={false} />
                        <Tooltip
                          contentStyle={{ border: '1px solid #e8ecf0', borderRadius: '8px', fontSize: '13px' }}
                          formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ventas']}
                          labelFormatter={(label) => `Dia ${label}`}
                        />
                        <Area activeDot={{ r: 5 }} dataKey="total" dot={{ fill: '#6366f1', r: 3 }} fill="url(#gradVentasSuperAdmin)" stroke="#6366f1" strokeWidth={2.5} type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: T.textMuted, padding: '40px', textAlign: 'center' }}>
                      <p style={{ fontSize: '28px', margin: '0 0 8px' }}>📈</p>
                      <p style={{ color: T.text, fontWeight: 600, margin: 0 }}>Sin ventas este mes</p>
                    </div>
                  )}
                </div>
                <div style={{ background: '#ffffff', border: '1.5px solid #e8ecf0', borderRadius: '14px', marginBottom: '16px', padding: '20px 22px' }}>
                  <h3 style={{ margin: '0 0 16px' }}>Ventas por empresa</h3>
                  {(metricas?.ventasPorEmpresa || []).length > 0 ? (
                    <table style={{ borderCollapse: 'collapse', fontSize: '13px', width: '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                          {['#', 'Empresa', 'Pedidos', 'Total ventas', '% del total'].map((label, index) => (
                            <th key={label} style={{ color: T.textMuted, fontSize: '11px', fontWeight: 600, padding: '10px 14px', textAlign: index >= 2 ? 'right' : 'left', textTransform: 'uppercase' }}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metricas.ventasPorEmpresa.map((empresa, index) => {
                          const totalVentas = Number(metricValue(metricas, 'totalVentas', 'total_ventas_mes') || 0);
                          const pct = totalVentas > 0 ? ((Number(empresa.total || 0) / totalVentas) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={`${empresa.empresa_id || empresa.empresa}-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ color: T.textMuted, fontWeight: 700, padding: '12px 14px' }}>#{index + 1}</td>
                              <td style={{ color: T.text, fontWeight: 600, padding: '12px 14px' }}>{empresa.empresa}</td>
                              <td style={{ color: T.text, padding: '12px 14px', textAlign: 'right' }}>{empresa.pedidos}</td>
                              <td style={{ color: T.indigo, fontWeight: 700, padding: '12px 14px', textAlign: 'right' }}>S/ {Number(empresa.total || 0).toFixed(2)}</td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ alignItems: 'center', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <div style={{ background: '#e8ecf0', borderRadius: '3px', height: '6px', overflow: 'hidden', width: '60px' }}>
                                    <div style={{ background: '#6366f1', borderRadius: '3px', height: '100%', width: `${pct}%` }} />
                                  </div>
                                  <span style={{ color: T.textMuted, fontSize: '12px' }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: T.textMuted, padding: '20px', textAlign: 'center' }}>Sin datos este mes</p>
                  )}
                </div>
                <div style={{ background: '#ffffff', border: '1.5px solid #e8ecf0', borderRadius: '14px', marginBottom: '16px', padding: '20px 22px' }}><h3 style={{ marginTop: 0 }}>Empresas mas activas</h3><div style={{ display: 'grid', gap: 10 }}>{(metricas?.empresas_mas_activas || []).map((row, index) => <div key={row.empresa_id} style={{ alignItems: 'center', background: T.cardMuted, borderRadius: 12, display: 'grid', gap: 4, gridTemplateColumns: '40px 1fr auto auto', padding: '14px 16px' }}><div style={{ color: T.indigo, fontSize: 20, fontWeight: 900 }}>#{index + 1}</div><div><div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{row.empresa_nombre}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{row.pedidos} pedidos</div></div><div style={{ color: T.textMuted, fontSize: 13 }}>Ventas</div><div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{money(row.total_ventas)}</div></div>)}</div></div>
                <div style={{ background: '#ffffff', border: '1.5px solid #e8ecf0', borderRadius: '14px', marginBottom: '16px', padding: '20px 22px' }}>
                  <h3 style={{ margin: '0 0 16px' }}>Pedidos por canal</h3>
                  {(metricas?.pedidosPorCanal || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {metricas.pedidosPorCanal.map((canal, index) => {
                        const total = (metricas?.pedidosPorCanal || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
                        const pct = total > 0 ? Math.round((Number(canal.cantidad || 0) / total) * 100) : 0;
                        const canalColors = {
                          fisico: '#6366f1',
                          web: '#22c55e',
                          wsp: '#10b981',
                          otro: '#f59e0b',
                        };
                        const canalLabels = {
                          fisico: '🏪 POS / Fisico',
                          web: '🌐 Web',
                          wsp: '💬 WhatsApp',
                          otro: '📦 Otro',
                        };
                        const color = canalColors[canal.canal] ?? '#6b7280';
                        return (
                          <div key={`${canal.canal}-${index}`} style={{ alignItems: 'center', display: 'flex', gap: '12px' }}>
                            <div style={{ color: T.text, fontSize: '13px', fontWeight: 600, width: '120px' }}>
                              {canalLabels[canal.canal] ?? canal.canal}
                            </div>
                            <div style={{ background: '#e8ecf0', borderRadius: '5px', flex: 1, height: '10px', overflow: 'hidden' }}>
                              <div style={{ background: color, borderRadius: '5px', height: '100%', transition: 'width 0.5s ease', width: `${pct}%` }} />
                            </div>
                            <div style={{ color: T.textMuted, fontSize: '13px', textAlign: 'right', width: '80px' }}>
                              {canal.cantidad} pedidos
                            </div>
                            <div style={{ color, fontSize: '13px', fontWeight: 700, textAlign: 'right', width: '40px' }}>
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: T.textMuted, padding: '20px', textAlign: 'center' }}>Sin datos este mes</p>
                  )}
                </div>
                {false && (<div>
                  <h3 style={{ margin: '0 0 16px' }}>Uso por empresa</h3>
                  {(metricas?.usoEmpresas || metricas?.uso_por_empresa || []).length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', minWidth: 980, width: '100%' }}>
                        <thead><tr style={{ background: T.cardMuted }}>{['Empresa', 'Tokens usados', 'Ejecuciones', 'Mes', '% del limite del plan'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                        <tbody>{(metricas?.usoEmpresas || metricas?.uso_por_empresa || []).map((row) => <tr key={`${row.empresa_id}-${row.mes}`}><td style={cell}><div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{row.empresa_nombre}</div><div style={{ color: T.textMuted, fontSize: 12 }}>{row.plan_nombre}</div></td><td style={{ ...cell, color: T.text }}>{Number(row.tokens_usados || 0).toLocaleString()}</td><td style={{ ...cell, color: T.textMuted }}>{Number(row.cantidad_ejecuciones || 0).toLocaleString()}</td><td style={{ ...cell, color: T.textMuted }}>{row.mes}</td><td style={cell}><div style={{ alignItems: 'center', display: 'flex', gap: 10 }}><div style={{ background: T.slateBg, borderRadius: 999, height: 8, overflow: 'hidden', width: 160 }}><div style={{ background: T.indigo, borderRadius: 999, height: '100%', width: `${Math.min(100, Number(row.porcentaje_limite || 0))}%` }} /></div><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{Number(row.porcentaje_limite || 0).toFixed(1)}%</span></div></td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ color: '#6b7280', padding: '32px', textAlign: 'center' }}>
                      <p style={{ fontSize: '28px', margin: '0 0 8px' }}>🤖</p>
                      <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Sin uso de IA este periodo</p>
                      <p style={{ fontSize: '13px', margin: 0 }}>
                        Los datos de tokens y ejecuciones apareceran cuando las empresas usen modulos de automatizacion.
                      </p>
                    </div>
                  )}
                </div>)}
                </div>
              </div>
            )}

            {nav === 'sistema' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ ...box, overflow: 'hidden' }}>
                  <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 20px' }}><h3 style={{ margin: 0 }}>Modulos disponibles</h3></div>
                  <div style={{ overflowX: 'auto', padding: 20 }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: 920, width: '100%' }}>
                      <thead><tr style={{ background: T.cardMuted }}>{['Nombre', 'Codigo', 'Descripcion', 'Activo', 'Empresas asignadas'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                      <tbody>{modulos.map((row) => <tr key={row.id}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.nombre}</td><td style={{ ...cell, color: T.textMuted }}>{row.codigo}</td><td style={{ ...cell, color: T.textMuted }}>{row.descripcion || '-'}</td><td style={cell}><button onClick={async () => { await request(`modulos/${row.id}/estado`, { method: 'PATCH', body: JSON.stringify({ activo: !row.activo }) }); await loadSistema(); }} style={{ background: row.activo ? T.successBg : T.slateBg, border: 'none', borderRadius: 999, color: row.activo ? T.success : T.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 12px' }} type="button">{row.activo ? 'Activo' : 'Inactivo'}</button></td><td style={{ ...cell, color: T.textMuted }}>{row.empresas_asignadas}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
                <div style={{ ...box, overflow: 'hidden' }}>
                  <div style={{ alignItems: 'center', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 10, justifyContent: 'space-between', padding: '18px 20px' }}>
                    <h3 style={{ margin: 0 }}>Auditoria</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select value={auditoriaEmpresaId} onChange={(e) => { setAuditoriaPage(1); setAuditoriaEmpresaId(e.target.value); }} style={input}><option value="">Todas las empresas</option>{companyOptions.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}</select>
                      <input value={auditoriaTipoAccion} onChange={(e) => { setAuditoriaPage(1); setAuditoriaTipoAccion(e.target.value); }} placeholder="Filtrar por tipo_accion" style={{ ...input, width: 220 }} />
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', padding: 20 }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: 980, width: '100%' }}>
                      <thead><tr style={{ background: T.cardMuted }}>{['Empresa', 'Usuario', 'Tipo accion', 'Estado', 'Fecha', 'Metadatos'].map((label) => <th key={label} style={head}>{label}</th>)}</tr></thead>
                      <tbody>{auditoria.map((row) => <tr key={row.id} onClick={() => setAuditoriaDetalle(row)} style={{ cursor: 'pointer' }}><td style={{ ...cell, color: T.text, fontWeight: 700 }}>{row.empresa_nombre}</td><td style={{ ...cell, color: T.textMuted }}>{row.usuario_email}</td><td style={{ ...cell, color: T.text }}>{row.tipo_accion}</td><td style={{ ...cell, color: T.textMuted }}>{row.estado}</td><td style={{ ...cell, color: T.textMuted }}>{formatDate(row.fecha_creacion, true)}</td><td style={{ ...cell, color: T.indigo, fontWeight: 800 }}>Ver JSON</td></tr>)}</tbody>
                    </table>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                      <span style={{ color: T.textMuted, fontSize: 13 }}>Pagina {auditoriaPage} de {Math.max(1, Math.ceil(auditoriaTotal / 10))}</span>
                      <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setAuditoriaPage((v) => Math.max(1, v - 1))} style={{ ...input, background: T.cardMuted, cursor: 'pointer' }} type="button">Anterior</button><button onClick={() => setAuditoriaPage((v) => Math.min(Math.max(1, Math.ceil(auditoriaTotal / 10)), v + 1))} style={{ ...input, background: T.cardMuted, cursor: 'pointer' }} type="button">Siguiente</button></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {nav === 'alertas' && <AlertasSucursal usuarioId={usuario.id} empresaId={usuario.empresa_id ?? null} token={token} apiBase={apiBase} polling={false} />}
          </div>
        </main>
      </div>

      <Modal open={Boolean(empresaDetalle)} onClose={() => setEmpresaDetalle(null)} title={empresaDetalle?.empresa?.nombre || 'Detalle de empresa'} width={760}>
        {empresaDetalle && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div style={{ background: T.cardMuted, borderRadius: 12, padding: '14px 16px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>RUC</div><div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 8 }}>{empresaDetalle.empresa?.ruc}</div></div>
              <div style={{ background: T.cardMuted, borderRadius: 12, padding: '14px 16px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Estado</div><div style={{ marginTop: 8 }}>{(() => { const state = badge(empresaDetalle.empresa?.estado); return <span style={{ background: state.bg, borderRadius: 999, color: state.color, fontSize: 12, fontWeight: 800, padding: '5px 10px' }}>{state.label}</span>; })()}</div></div>
              <div style={{ background: T.cardMuted, borderRadius: 12, padding: '14px 16px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Fecha creacion</div><div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 8 }}>{formatDate(empresaDetalle.empresa?.fecha_creacion, true)}</div></div>
            </div>
            <div style={{ background: T.cardMuted, borderRadius: 12, padding: '16px 18px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase' }}>Suscripcion actual</div>{empresaDetalle.suscripcion_actual ? <div style={{ display: 'grid', gap: 6 }}><div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>{empresaDetalle.suscripcion_actual.plan?.nombre || 'Sin plan'}</div><div style={{ color: T.textMuted, fontSize: 13 }}>{formatDate(empresaDetalle.suscripcion_actual.fecha_inicio)} - {formatDate(empresaDetalle.suscripcion_actual.fecha_fin)}</div><div style={{ color: T.textMuted, fontSize: 13 }}>Estado: {empresaDetalle.suscripcion_actual.estado}</div></div> : <div style={{ color: T.textMuted, fontSize: 13 }}>Sin suscripcion activa.</div>}</div>
            <div style={{ background: T.cardMuted, borderRadius: 12, padding: '16px 18px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase' }}>Modulos activos</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{(empresaDetalle.modulos_activos || []).map((modulo) => <span key={modulo.id} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 999, color: T.text, fontSize: 12, fontWeight: 700, padding: '8px 12px' }}>{modulo.nombre}</span>)}</div></div>
            <div style={{ background: T.cardMuted, borderRadius: 12, padding: '16px 18px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase' }}>Usuarios por rol</div><div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{[['Admin empresa', empresaDetalle.usuarios_por_rol?.admin_empresa || 0], ['Encargados', empresaDetalle.usuarios_por_rol?.encargado_sucursal || 0], ['Vendedores', empresaDetalle.usuarios_por_rol?.vendedor || 0]].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px' }}><div style={{ color: T.textMuted, fontSize: 11, fontWeight: 700 }}>{label}</div><div style={{ color: T.text, fontSize: 24, fontWeight: 900, marginTop: 8 }}>{value}</div></div>)}</div></div>
          </div>
        )}
      </Modal>

      <Modal open={planModal} onClose={() => setPlanModal(false)} title={editingPlan ? 'Editar plan' : 'Crear plan'} width={560}>
        <div style={{ display: 'grid', gap: 12 }}>
          <input value={planForm.nombre} onChange={(e) => setPlanForm((v) => ({ ...v, nombre: e.target.value }))} placeholder="Nombre del plan" style={input} />
          <input value={planForm.precio} onChange={(e) => setPlanForm((v) => ({ ...v, precio: e.target.value }))} placeholder="Precio mensual" type="number" style={input} />
          <input value={planForm.maximo_usuarios} onChange={(e) => setPlanForm((v) => ({ ...v, maximo_usuarios: e.target.value }))} placeholder="Maximo usuarios" type="number" style={input} />
          <input value={planForm.limite_tokens_mensual} onChange={(e) => setPlanForm((v) => ({ ...v, limite_tokens_mensual: e.target.value }))} placeholder="Limite tokens/mes" type="number" style={input} />
          <input value={planForm.limite_ejecuciones_mensual} onChange={(e) => setPlanForm((v) => ({ ...v, limite_ejecuciones_mensual: e.target.value }))} placeholder="Limite ejecuciones/mes" type="number" style={input} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => void savePlan()} style={{ background: T.indigo, border: 'none', borderRadius: 999, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '11px 16px' }} type="button">{editingPlan ? 'Actualizar plan' : 'Crear plan'}</button></div>
        </div>
      </Modal>

      <Modal open={modalEditarUsuario} onClose={closeEditarUsuarioModal} title="Editar usuario" width={480}>
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>
              {formUsuario.empresa_nombre}
              {formUsuario.sucursal_nombre !== '-' && ` · ${formUsuario.sucursal_nombre}`}
            </p>
            <p style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', margin: '0 0 16px', textTransform: 'uppercase' }}>Datos del usuario</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario((prev) => ({ ...prev, email: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Nueva contrasena
                </label>
                <input
                  type="password"
                  placeholder="Dejar vacio para no cambiar"
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
                <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                  Solo completa este campo si deseas cambiar la contrasena.
                </p>
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Rol
                </label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario((prev) => ({ ...prev, rol: e.target.value }))}
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', cursor: 'pointer', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                >
                  <option value="admin_empresa">Admin empresa</option>
                  <option value="encargado_sucursal">Encargado de sucursal</option>
                  <option value="vendedor">Vendedor</option>
                </select>
              </div>

              <div style={{ background: '#f5f6fa', borderRadius: 10, display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', padding: '12px 16px' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>Empresa</p>
                  <p style={{ color: '#1a1a2e', fontSize: 14, fontWeight: 600, margin: 0 }}>{formUsuario.empresa_nombre}</p>
                </div>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>Sucursal</p>
                  <p style={{ color: '#1a1a2e', fontSize: 14, fontWeight: 600, margin: 0 }}>{formUsuario.sucursal_nombre || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={closeEditarUsuarioModal} style={{ background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px' }} type="button">Cancelar</button>
            <button onClick={() => handleGuardarUsuario()} disabled={editandoUsuario || !formUsuario.email} style={{ background: !formUsuario.email ? '#c7d2fe' : '#6366f1', border: 'none', borderRadius: 8, color: '#ffffff', cursor: !formUsuario.email ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, padding: '10px 24px' }} type="button">{editandoUsuario ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={modalEditarEmpresa} onClose={closeEditarEmpresaModal} title="Editar empresa" width={500}>
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <p style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', margin: '0 0 16px', textTransform: 'uppercase' }}>Datos de la empresa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Nombre de la empresa <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.nombre}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, nombre: e.target.value }))}
                  autoComplete="off"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  RUC <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.ruc}
                  maxLength={11}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, ruc: e.target.value.replace(/\D/g, '') }))}
                  autoComplete="off"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Estado
                </label>
                <select
                  value={formEditar.estado}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, estado: e.target.value }))}
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', cursor: 'pointer', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                >
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Plan
                </label>
                <select
                  value={formEditar.planId}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, planId: e.target.value }))}
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: formEditar.planId ? '#1a1a2e' : '#9ca3af', cursor: 'pointer', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                >
                  <option value="">Sin plan</option>
                  {planes.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} - S/ {Number(plan.precio || 0).toFixed(2)}/mes
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', margin: '24px 0 16px', textTransform: 'uppercase' }}>Usuario administrador</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={formEditar.adminEmail}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, adminEmail: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Nueva contrasena
                </label>
                <input
                  type="password"
                  placeholder="Dejar vacio para no cambiar"
                  value={formEditar.adminPassword}
                  onChange={(e) => setFormEditar((prev) => ({ ...prev, adminPassword: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
                <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                  Solo completa este campo si deseas cambiar la contrasena.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={closeEditarEmpresaModal} style={{ background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px' }} type="button">Cancelar</button>
            <button onClick={() => handleGuardarEdicion()} disabled={editandoEmpresa || !formEditar.nombre || !formEditar.ruc} style={{ background: (!formEditar.nombre || !formEditar.ruc) ? '#c7d2fe' : '#6366f1', border: 'none', borderRadius: 8, color: '#ffffff', cursor: (!formEditar.nombre || !formEditar.ruc) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, padding: '10px 24px' }} type="button">{editandoEmpresa ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={modalCrearEmpresa} onClose={closeCrearEmpresaModal} title="Nueva empresa" width={500}>
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <p style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', margin: '0 0 16px', textTransform: 'uppercase' }}>Datos de la empresa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Nombre de la empresa <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Norte SAC"
                  value={formEmpresa.nombre}
                  onChange={(e) => setFormEmpresa((prev) => ({ ...prev, nombre: e.target.value }))}
                  autoComplete="off"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  RUC <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: 20512345678"
                  value={formEmpresa.ruc}
                  maxLength={11}
                  onChange={(e) => setFormEmpresa((prev) => ({ ...prev, ruc: e.target.value.replace(/\D/g, '') }))}
                  autoComplete="off"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Plan inicial <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={formEmpresa.planId || ''}
                  onChange={(e) => setFormEmpresa((prev) => ({ ...prev, planId: e.target.value }))}
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: formEmpresa.planId ? '#1a1a2e' : '#9ca3af', cursor: 'pointer', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                >
                  <option value="">Seleccionar plan...</option>
                  {planes.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} - S/ {Number(plan.precio || 0).toFixed(2)}/mes
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', margin: '0 0 16px', textTransform: 'uppercase' }}>Usuario administrador</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="Ej: admin@empresa.com"
                  value={formEmpresa.adminEmail}
                  onChange={(e) => setFormEmpresa((prev) => ({ ...prev, adminEmail: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: '#374151', display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Contrasena temporal <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  value={formEmpresa.adminPassword}
                  onChange={(e) => setFormEmpresa((prev) => ({ ...prev, adminPassword: e.target.value }))}
                  autoComplete="new-password"
                  style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', color: '#1a1a2e', fontSize: 14, outline: 'none', padding: '10px 14px', width: '100%' }}
                />
                <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                  El administrador podra cambiarla despues de su primer ingreso.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={closeCrearEmpresaModal} style={{ background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px' }} type="button">Cancelar</button>
            <button onClick={() => handleCrearEmpresa()} disabled={creandoEmpresa || !formEmpresa.nombre || !formEmpresa.ruc || !formEmpresa.adminEmail || !formEmpresa.adminPassword || !formEmpresa.planId} style={{ background: (!formEmpresa.nombre || !formEmpresa.ruc || !formEmpresa.adminEmail || !formEmpresa.adminPassword || !formEmpresa.planId) ? '#c7d2fe' : '#6366f1', border: 'none', borderRadius: 8, color: '#ffffff', cursor: (!formEmpresa.nombre || !formEmpresa.ruc || !formEmpresa.adminEmail || !formEmpresa.adminPassword || !formEmpresa.planId) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, padding: '10px 24px' }} type="button">{creandoEmpresa ? 'Creando...' : 'Crear empresa'}</button>
          </div>
        </div>
      </Modal>

      {mostrarModalPassword && (
        <ModalCambiarPassword
          onCerrar={() => setMostrarModalPassword(false)}
          onCambioExitoso={() => setMostrarModalPassword(false)}
        />
      )}

      <Modal open={Boolean(auditoriaDetalle)} onClose={() => setAuditoriaDetalle(null)} title="Metadatos de auditoria" width={760}>
        <pre style={{ background: '#0f172a', borderRadius: 12, color: '#e2e8f0', fontSize: 12, lineHeight: 1.6, margin: 0, overflowX: 'auto', padding: 16 }}>{JSON.stringify(auditoriaDetalle?.metadatos ?? {}, null, 2)}</pre>
      </Modal>
    </>
  );
}
