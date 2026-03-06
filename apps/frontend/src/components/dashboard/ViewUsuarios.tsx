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
  textDim: '#2a3f30',
  font: 'DM Sans',
  fontMono: 'DM Mono',
};

const inputStyle = {
  width: '100%',
  background: T.bg,
  border: `1px solid ${T.border2}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: T.text,
  fontSize: 13,
  fontFamily: T.font,
  outline: 'none',
};

const btnBase = {
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '8px 12px',
  fontFamily: T.font,
};

const roles = [
  { id: 'admin_empresa', label: 'admin_empresa' },
  { id: 'encargado_sucursal', label: 'encargado_sucursal' },
  { id: 'vendedor', label: 'vendedor' },
];

interface ViewUsuariosProps {
  usuario?: any;
}

export const ViewUsuarios = ({ usuario }: ViewUsuariosProps) => {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'editar'>('crear');
  const [usuarioEditando, setUsuarioEditando] = useState<any>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    rol: 'vendedor',
    sucursal_id: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Confirm desactivar
  const [confirmToggle, setConfirmToggle] = useState<any>(null);

  // Reset password
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetEnviado, setResetEnviado] = useState(false);

  const esAdminEmpresa = usuario?.rol === 'admin_empresa' || usuario?.rol === 'super_admin';
  const esAdminEmpresaNoSuper = usuario?.rol === 'admin_empresa';
  const rolesDisponibles = useMemo(
    () =>
      esAdminEmpresaNoSuper
        ? roles.filter((rol) => rol.id !== 'admin_empresa')
        : roles,
    [esAdminEmpresaNoSuper],
  );

  const cargarUsuarios = async () => {
    const data = await operacionesService.getUsuarios();
    setUsuarios(Array.isArray(data) ? data : data?.usuarios || []);
  };

  useEffect(() => {
    Promise.all([operacionesService.getUsuarios(), operacionesService.getSucursales()])
      .then(([usersRes, sucRes]) => {
        setUsuarios(Array.isArray(usersRes) ? usersRes : usersRes?.usuarios || []);
        setSucursales(Array.isArray(sucRes) ? sucRes : sucRes?.sucursales || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
          u.rol?.toLowerCase().includes(busqueda.toLowerCase()),
      ),
    [usuarios, busqueda],
  );

  const sucursalNombre = (sucursal_id: string | null) => {
    if (!sucursal_id) return '—';
    return sucursales.find((s) => s.id === sucursal_id)?.nombre || '—';
  };

  const abrirCrear = () => {
    setModoModal('crear');
    setUsuarioEditando(null);
    setForm({
      email: '',
      password: '',
      rol: 'vendedor',
      sucursal_id: '',
    });
    setError('');
    setModalAbierto(true);
  };

  const abrirEditar = (u: any) => {
    setModoModal('editar');
    setUsuarioEditando(u);
    setForm({
      email: u?.email || '',
      password: '',
      rol: u?.rol || 'vendedor',
      sucursal_id: u?.sucursal_id || '',
    });
    setError('');
    setModalAbierto(true);
  };

  const validarForm = () => {
    if (modoModal === 'crear') {
      if (!form.email || !form.email.includes('@')) {
        setError('Email invalido');
        return false;
      }
      if (!form.password || form.password.length < 8) {
        setError('Password debe tener minimo 8 caracteres');
        return false;
      }
    }
    if (form.rol !== 'admin_empresa' && !form.sucursal_id) {
      setError('Debes asignar una sucursal para este rol');
      return false;
    }
    return true;
  };

  const guardar = async () => {
    if (!validarForm()) return;
    setGuardando(true);
    setError('');
    try {
      if (modoModal === 'crear') {
        await operacionesService.crearUsuario({
          email: form.email,
          password: form.password,
          rol: form.rol,
          sucursal_id: form.rol === 'admin_empresa' ? null : form.sucursal_id,
        });
      } else {
        await operacionesService.editarUsuario(usuarioEditando.id, {
          rol: form.rol,
          sucursal_id: form.rol === 'admin_empresa' ? null : form.sucursal_id,
        });
      }
      const data = await operacionesService.getUsuarios();
      setUsuarios(Array.isArray(data) ? data : data?.usuarios || []);
      setModalAbierto(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    } finally {
      setGuardando(false);
    }
  };

  const enviarResetPassword = async (email: string) => {
    try {
      await operacionesService.resetPasswordUsuario(email);
      setResetEmail(null);
      setResetEnviado(true);
      setTimeout(() => setResetEnviado(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al enviar reset');
    }
  };

  const toggleUsuario = async (usuarioItem: any) => {
    try {
      await operacionesService.toggleUsuario(usuarioItem.id, !usuarioItem.activo);
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuarioItem.id ? { ...u, activo: !u.activo } : u,
        ),
      );
    } catch (err: any) {
      alert(err.message || 'Error al actualizar usuario');
    } finally {
      setConfirmToggle(null);
    }
  };

  const roleBadge = (rol: string) => {
    const colors =
      rol === 'admin_empresa'
        ? { bg: '#00e87b20', color: T.accent }
        : rol === 'encargado_sucursal'
          ? { bg: '#f59e0b20', color: '#f59e0b' }
          : { bg: '#3b82f620', color: '#3b82f6' };
    return (
      <span
        style={{
          background: colors.bg,
          color: colors.color,
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'lowercase',
        }}
      >
        {rol}
      </span>
    );
  };

  const estadoBadge = (activo: boolean) => (
    <span
      style={{
        background: activo ? '#00e87b20' : '#ef444420',
        color: activo ? '#00e87b' : '#ef4444',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {activo ? 'activo' : 'inactivo'}
    </span>
  );

  return (
    <div className="fade" style={{ color: T.text, fontFamily: T.font }}>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Usuarios</h2>
            <div style={{ marginTop: 4, fontSize: 11, color: T.textMid }}>{usuarios.length} usuarios</div>
          </div>
          <button
            type="button"
            onClick={abrirCrear}
            disabled={!esAdminEmpresa}
            style={{
              ...btnBase,
              background: esAdminEmpresa ? T.accent : `${T.textDim}55`,
              color: T.bg,
              border: 'none',
              opacity: esAdminEmpresa ? 1 : 0.5,
            }}
          >
            + Nuevo Usuario
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por email o rol..."
            style={inputStyle}
          />
        </div>

        {!esAdminEmpresa && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: '#f59e0b',
              background: '#f59e0b18',
              border: '1px solid #f59e0b33',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            Solo admin_empresa puede gestionar usuarios.
          </div>
        )}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr style={{ background: T.bg }}>
              {['EMAIL', 'ROL', 'SUCURSAL', 'ESTADO', 'FECHA', 'ACCIONES'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: 10,
                    color: T.textDim,
                    fontFamily: T.fontMono,
                    letterSpacing: '0.08em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    color: T.textMid,
                    fontSize: 12,
                  }}
                >
                  Cargando usuarios...
                </td>
              </tr>
            )}

            {!loading && usuariosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    color: T.textMid,
                    fontSize: 12,
                  }}
                >
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}

            {!loading &&
              usuariosFiltrados.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: T.text }}>{u.email || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>{roleBadge(u.rol || 'vendedor')}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: T.textMid }}>
                    {sucursalNombre(u.sucursal_id)}
                  </td>
                  <td style={{ padding: '11px 14px' }}>{estadoBadge(Boolean(u.activo))}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: T.textMid, fontFamily: T.fontMono }}>
                    {u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-PE') : '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {u.id === usuario?.id ? (
                      <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.fontMono }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={!esAdminEmpresa}
                          onClick={() => abrirEditar(u)}
                          style={{
                            ...btnBase,
                            background: '#3b82f620',
                            border: '1px solid #3b82f640',
                            color: '#3b82f6',
                            opacity: esAdminEmpresa ? 1 : 0.4,
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={!esAdminEmpresa}
                          onClick={() => setResetEmail(u.email)}
                          style={{
                            ...btnBase,
                            background: '#f59e0b20',
                            border: '1px solid #f59e0b40',
                            color: '#f59e0b',
                            opacity: esAdminEmpresa ? 1 : 0.4,
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          disabled={!esAdminEmpresa}
                          onClick={() => setConfirmToggle(u)}
                          style={{
                            ...btnBase,
                            background: u.activo ? '#ef444420' : '#00e87b20',
                            border: u.activo ? '1px solid #ef444440' : '1px solid #00e87b40',
                            color: u.activo ? '#ef4444' : '#00e87b',
                            opacity: esAdminEmpresa ? 1 : 0.4,
                          }}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!guardando) setModalAbierto(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${T.border}`,
                background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)`,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {modoModal === 'crear' ? 'Nuevo Usuario' : 'Editar Usuario'}
              </div>
              {modoModal === 'editar' && (
                <div style={{ marginTop: 4, fontSize: 11, color: T.textMid }}>{usuarioEditando?.email}</div>
              )}
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {modoModal === 'crear' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: T.textMid }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@empresa.com"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: T.textMid }}>
                      Password *
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Minimo 8 caracteres"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: T.textMid }}>
                  Rol *
                </label>
                <select
                  value={form.rol}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rol: e.target.value,
                      sucursal_id: e.target.value === 'admin_empresa' ? '' : prev.sucursal_id,
                    }))
                  }
                  style={inputStyle}
                >
                  {rolesDisponibles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.label}
                    </option>
                  ))}
                </select>
              </div>

              {form.rol !== 'admin_empresa' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 5, color: T.textMid }}>
                    Sucursal *
                  </label>
                  <select
                    value={form.sucursal_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, sucursal_id: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Selecciona una sucursal</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div
                  style={{
                    background: '#ef444418',
                    border: '1px solid #ef444440',
                    borderRadius: 8,
                    color: '#ef4444',
                    fontSize: 12,
                    padding: '8px 10px',
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
                borderTop: `1px solid ${T.border}`,
                padding: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                disabled={guardando}
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
                onClick={() => void guardar()}
                disabled={guardando}
                style={{
                  ...btnBase,
                  background: T.accent,
                  border: 'none',
                  color: T.bg,
                  minWidth: 140,
                }}
              >
                {guardando
                  ? 'Guardando...'
                  : modoModal === 'crear'
                    ? 'Crear Usuario'
                    : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmToggle && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmToggle(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1401,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {confirmToggle.activo ? 'Desactivar usuario' : 'Activar usuario'}
            </div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 14 }}>
              {confirmToggle.email}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmToggle(null)}
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
                onClick={() => void toggleUsuario(confirmToggle)}
                style={{
                  ...btnBase,
                  background: confirmToggle.activo ? '#ef4444' : '#00e87b',
                  border: 'none',
                  color: confirmToggle.activo ? '#fff' : T.bg,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {resetEmail && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setResetEmail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1402,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Enviar reset password</div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 14 }}>{resetEmail}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setResetEmail(null)}
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
                onClick={() => void enviarResetPassword(resetEmail)}
                style={{
                  ...btnBase,
                  background: '#f59e0b',
                  border: 'none',
                  color: '#111',
                }}
              >
                Enviar reset
              </button>
            </div>
          </div>
        </div>
      )}

      {resetEnviado && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: T.accent,
            color: T.bg,
            padding: '12px 20px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            zIndex: 9999,
          }}
        >
          ✓ Email de reset enviado
        </div>
      )}
    </div>
  );
};
