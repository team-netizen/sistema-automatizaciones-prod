import { useEffect, useMemo, useState } from 'react';
import { AUTH_URL } from '../lib/api';
import { setMustChangePasswordOverride } from '../lib/auth';
import { getSupabaseClient } from '../lib/supabaseClient';

const T = {
  bg: '#07090b',
  surface: '#0b0f12',
  border: '#151d24',
  border2: '#1c2830',
  accent: '#00e87b',
  text: '#e8f5ee',
  textMid: '#4d6b58',
  danger: '#ef4444',
  font: 'DM Sans',
};

export default function ResetPassword() {
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState<boolean | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const type = hashParams.get('type') || queryParams.get('type');
    setIsRecovery(type === 'recovery');

    if (supabase) {
      void supabase.auth.getSession();
    } else {
      setError('Cliente de autenticacion no configurado');
    }
  }, [supabase]);

  const canSubmit = useMemo(() => !loading && isRecovery === true, [loading, isRecovery]);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('Minimo 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const hashToken = hashParams.get('access_token');
    const sessionToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
    const accessToken = hashToken || sessionToken;

    if (!accessToken) {
      setError('No se encontro un token de recuperacion valido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${AUTH_URL}/cambiar-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ nuevaPassword: password }),
      });

      if (!response.ok) {
        setError('No se pudo actualizar la contrasena');
      } else {
        setMustChangePasswordOverride(false);
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch {
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ alignItems: 'center', background: T.bg, color: T.accent, display: 'flex', fontFamily: T.font, fontSize: 18, height: '100vh', justifyContent: 'center' }}>
        ✓ Contrasena actualizada. Redirigiendo...
      </div>
    );
  }

  if (isRecovery === false) {
    return (
      <div style={{ alignItems: 'center', background: T.bg, color: T.text, display: 'flex', fontFamily: T.font, height: '100vh', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, maxWidth: 460, padding: 24 }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Enlace invalido o expirado</div>
          <div style={{ color: T.textMid, fontSize: 13 }}>
            Solicita nuevamente el correo de recuperacion de contrasena.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ alignItems: 'center', background: T.bg, display: 'flex', height: '100vh', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 32, width: 360 }}>
        <h2 style={{ color: T.text, fontFamily: T.font, marginBottom: 24, marginTop: 0 }}>
          Nueva contrasena
        </h2>

        <input
          type="password"
          placeholder="Nueva contrasena (min. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, boxSizing: 'border-box', color: T.text, fontSize: 13, marginBottom: 12, padding: '10px 14px', width: '100%' }}
        />

        <input
          type="password"
          placeholder="Confirmar contrasena"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, boxSizing: 'border-box', color: T.text, fontSize: 13, marginBottom: 12, padding: '10px 14px', width: '100%' }}
        />

        {error && <div style={{ color: T.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{ background: T.accent, border: 'none', borderRadius: 8, color: T.bg, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, opacity: canSubmit ? 1 : 0.6, padding: '12px 0', width: '100%' }}
          type="button"
        >
          {loading ? 'Guardando...' : 'Actualizar contrasena'}
        </button>
      </div>
    </div>
  );
}
