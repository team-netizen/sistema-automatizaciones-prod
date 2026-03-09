import { useState } from 'react';
import { AUTH_URL, apiFetch } from '../../lib/api';
import { setMustChangePasswordOverride } from '../../lib/auth';

type CambiarPasswordObligatorioProps = {
  onCambioExitoso: () => void;
};

export default function CambiarPasswordObligatorio({ onCambioExitoso }: CambiarPasswordObligatorioProps) {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleCambiar = async () => {
    setError('');

    if (nuevaPassword.length < 6) {
      setError('La contrasena debe tener minimo 6 caracteres');
      return;
    }

    if (nuevaPassword !== confirmar) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setCargando(true);
    try {
      const response = await apiFetch(`${AUTH_URL}/cambiar-password`, {
        method: 'POST',
        body: JSON.stringify({ nuevaPassword }),
      });

      if (!response.ok) {
        setError('Error al cambiar la contrasena. Intenta de nuevo.');
        return;
      }

      setMustChangePasswordOverride(false);
      const usuario = JSON.parse(sessionStorage.getItem('usuario') ?? '{}');
      sessionStorage.setItem('usuario', JSON.stringify({
        ...usuario,
        must_change_password: false,
      }));
      onCambioExitoso();
    } catch {
      setError('Error de conexion');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ alignItems: 'center', background: '#f5f6fa', display: 'flex', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', maxWidth: '95vw', padding: '40px', textAlign: 'center', width: '420px' }}>
        <div style={{ alignItems: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '16px', display: 'flex', fontSize: '28px', height: '64px', justifyContent: 'center', margin: '0 auto 20px', width: '64px' }}>🔐</div>
        <h2 style={{ color: '#1a1a2e', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Cambia tu contrasena</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.5, margin: '0 0 28px' }}>
          Por seguridad, debes cambiar tu contrasena temporal antes de continuar.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ color: '#374151', display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Nueva contrasena
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarNueva ? 'text' : 'password'}
                placeholder="Minimo 6 caracteres"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '10px', boxSizing: 'border-box', color: '#111827', fontSize: '14px', outline: 'none', padding: '11px 44px 11px 14px', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setMostrarNueva((prev) => !prev)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0, position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                {mostrarNueva ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ color: '#374151', display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Confirmar contrasena
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarConfirmar ? 'text' : 'password'}
                placeholder="Repite la contrasena"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCambiar()}
                style={{ background: '#ffffff', border: '1.5px solid #d1d5db', borderRadius: '10px', boxSizing: 'border-box', color: '#111827', fontSize: '14px', outline: 'none', padding: '11px 44px 11px 14px', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar((prev) => !prev)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0, position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                {mostrarConfirmar ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center' }}>{error}</p>}

          <button
            onClick={() => void handleCambiar()}
            disabled={cargando || !nuevaPassword || !confirmar}
            style={{ background: cargando || !nuevaPassword || !confirmar ? '#c7d2fe' : '#6366f1', border: 'none', borderRadius: '10px', color: '#ffffff', cursor: cargando || !nuevaPassword || !confirmar ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, marginTop: '4px', padding: '13px', width: '100%' }}
            type="button"
          >
            {cargando ? 'Guardando...' : 'Guardar contrasena'}
          </button>
        </div>
      </div>
    </div>
  );
}
