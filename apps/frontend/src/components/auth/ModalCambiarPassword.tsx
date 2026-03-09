import { useState } from 'react';
import { AUTH_URL, apiFetch } from '../../lib/api';
import { setMustChangePasswordOverride } from '../../lib/auth';

interface ModalCambiarPasswordProps {
  onCerrar: () => void;
  onCambioExitoso: () => void;
}

const inputStyle = {
  width: '100%',
  padding: '11px 44px 11px 14px',
  borderRadius: '10px',
  border: '1.5px solid #d1d5db',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  color: '#111827',
  background: '#ffffff',
};

export default function ModalCambiarPassword({
  onCerrar,
  onCambioExitoso,
}: ModalCambiarPasswordProps) {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleCambiar = async () => {
    setError('');

    if (nuevaPassword.length < 6) {
      setError('Minimo 6 caracteres');
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
        setError('Error al cambiar. Intenta de nuevo.');
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '36px',
          width: '420px',
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 16px',
          }}
        >
          🔐
        </div>

        <h2 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
          Cambia tu contrasena
        </h2>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 24px', lineHeight: 1.5 }}>
          Por seguridad, te recomendamos cambiar tu contrasena temporal antes de continuar.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Nueva contrasena
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarNueva ? 'text' : 'password'}
                placeholder="Minimo 6 caracteres"
                value={nuevaPassword}
                onChange={(event) => setNuevaPassword(event.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setMostrarNueva((prev) => !prev)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', lineHeight: 1, padding: 0 }}
              >
                {mostrarNueva ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Confirmar contrasena
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarConfirmar ? 'text' : 'password'}
                placeholder="Repite la contrasena"
                value={confirmar}
                onChange={(event) => setConfirmar(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void handleCambiar()}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar((prev) => !prev)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', lineHeight: 1, padding: 0 }}
              >
                {mostrarConfirmar ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center' }}>{error}</p>
          )}

          <button
            onClick={() => void handleCambiar()}
            disabled={cargando || !nuevaPassword || !confirmar}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '10px',
              border: 'none',
              background: cargando || !nuevaPassword || !confirmar ? '#c7d2fe' : '#6366f1',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: cargando || !nuevaPassword || !confirmar ? 'not-allowed' : 'pointer',
              marginTop: '4px',
            }}
            type="button"
          >
            {cargando ? 'Guardando...' : 'Guardar contrasena'}
          </button>

          <button
            onClick={onCerrar}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: '13px',
              textAlign: 'center',
              padding: '4px',
            }}
            type="button"
          >
            Cambiar mas tarde
          </button>
        </div>
      </div>
    </div>
  );
}
