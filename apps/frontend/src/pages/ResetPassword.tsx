import { useEffect, useMemo, useState } from 'react';
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
      // Allows Supabase client to process recovery token from URL hash.
      void supabase.auth.getSession();
    } else {
      setError('Cliente de autenticacion no configurado');
    }
  }, [supabase]);

  const canSubmit = useMemo(() => !loading && isRecovery === true, [loading, isRecovery]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError('Minimo 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }

    if (!supabase) {
      setError('Cliente de autenticacion no configurado');
      return;
    }

    setLoading(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: T.bg,
          color: T.accent,
          fontSize: 18,
          fontFamily: T.font,
        }}
      >
        ✓ Contrasena actualizada. Redirigiendo...
      </div>
    );
  }

  if (isRecovery === false) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: T.bg,
          color: T.text,
          fontFamily: T.font,
          padding: 16,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 24,
            maxWidth: 460,
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 8 }}>Enlace invalido o expirado</div>
          <div style={{ fontSize: 13, color: T.textMid }}>
            Solicita nuevamente el correo de recuperacion de contrasena.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: T.bg,
        padding: 16,
      }}
    >
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 32,
          width: 360,
        }}
      >
        <h2 style={{ color: T.text, fontFamily: T.font, marginTop: 0, marginBottom: 24 }}>
          Nueva contrasena
        </h2>

        <input
          type="password"
          placeholder="Nueva contrasena (min. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            background: T.bg,
            border: `1px solid ${T.border2}`,
            borderRadius: 8,
            padding: '10px 14px',
            color: T.text,
            fontSize: 13,
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        <input
          type="password"
          placeholder="Confirmar contrasena"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={{
            width: '100%',
            background: T.bg,
            border: `1px solid ${T.border2}`,
            borderRadius: 8,
            padding: '10px 14px',
            color: T.text,
            fontSize: 13,
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        {error && <div style={{ color: T.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{
            width: '100%',
            background: T.accent,
            border: 'none',
            borderRadius: 8,
            padding: '12px 0',
            color: T.bg,
            fontWeight: 700,
            fontSize: 14,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          {loading ? 'Guardando...' : 'Actualizar contrasena'}
        </button>
      </div>
    </div>
  );
}
