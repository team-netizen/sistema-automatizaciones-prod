import { useEffect, useState } from 'react';
import { AUTH_URL } from '../lib/api';
import { setMustChangePasswordOverride } from '../lib/auth';

interface ResetPasswordProps {
  onExito?: () => void;
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

export default function ResetPassword({ onExito }: ResetPasswordProps) {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [enlaceValido, setEnlaceValido] = useState(true);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const hashToken = params.get('access_token');
    const hashType = params.get('type');
    const storedToken = sessionStorage.getItem('recovery_token') ?? '';

    if (hashType === 'recovery' && hashToken) {
      sessionStorage.setItem('recovery_token', hashToken);
      setRecoveryToken(hashToken);
      setEnlaceValido(true);
      return;
    }

    if (storedToken) {
      setRecoveryToken(storedToken);
      setEnlaceValido(true);
      return;
    }

    setRecoveryToken('');
    setEnlaceValido(false);
  }, []);

  const handleReset = async () => {
    setError('');

    if (nuevaPassword.length < 6) {
      setError('Minimo 6 caracteres');
      return;
    }

    if (nuevaPassword !== confirmar) {
      setError('Las contrasenas no coinciden');
      return;
    }

    if (!recoveryToken) {
      setError('No se encontro un token de recuperacion valido');
      return;
    }

    setCargando(true);

    try {
      const response = await fetch(`${AUTH_URL}/cambiar-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recoveryToken}`,
        },
        body: JSON.stringify({ nuevaPassword }),
      });

      if (!response.ok) {
        setError('Error al cambiar. Intenta de nuevo.');
        return;
      }

      const usuarioGuardado = sessionStorage.getItem('usuario');
      if (usuarioGuardado) {
        try {
          const usuario = JSON.parse(usuarioGuardado);
          usuario.must_change_password = false;
          sessionStorage.setItem('usuario', JSON.stringify(usuario));
        } catch {
          // Ignore malformed session payloads.
        }
      }

      setMustChangePasswordOverride(false);
      sessionStorage.removeItem('recovery_token');
      window.history.replaceState(null, '', window.location.pathname);
      setExito(true);
    } catch {
      setError('Error de conexion');
    } finally {
      setCargando(false);
    }
  };

  if (exito) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f6fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '40px',
            width: '420px',
            maxWidth: '95vw',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>✅</p>
          <h2 style={{ color: '#1a1a2e', margin: '0 0 8px' }}>Contrasena actualizada</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
            Ya puedes iniciar sesion con tu nueva contrasena.
          </p>
          <button
            onClick={() => onExito?.()}
            style={{
              padding: '12px 32px',
              borderRadius: '10px',
              border: 'none',
              background: '#6366f1',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (!enlaceValido) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f6fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '40px',
            width: '420px',
            maxWidth: '95vw',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>⚠️</p>
          <h2 style={{ color: '#1a1a2e', margin: '0 0 8px' }}>Enlace invalido o expirado</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
            Solicita un nuevo correo de recuperacion para continuar.
          </p>
          <button
            onClick={() => onExito?.()}
            style={{
              padding: '12px 32px',
              borderRadius: '10px',
              border: 'none',
              background: '#6366f1',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f6fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '40px',
          width: '420px',
          maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
            🔑
          </div>
          <h2 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
            Nueva contrasena
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Ingresa tu nueva contrasena para continuar.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
              }}
            >
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
                onClick={() => setMostrarNueva((current) => !current)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '18px',
                  padding: 0,
                }}
              >
                {mostrarNueva ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
              }}
            >
              Confirmar contrasena
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarConfirmar ? 'text' : 'password'}
                placeholder="Repite la contrasena"
                value={confirmar}
                onChange={(event) => setConfirmar(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleReset();
                  }
                }}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar((current) => !current)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '18px',
                  padding: 0,
                }}
              >
                {mostrarConfirmar ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            onClick={() => void handleReset()}
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
            }}
            type="button"
          >
            {cargando ? 'Guardando...' : 'Guardar nueva contrasena'}
          </button>
        </div>
      </div>
    </div>
  );
}
