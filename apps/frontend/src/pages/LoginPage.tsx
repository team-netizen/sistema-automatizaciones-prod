import { useState } from 'react';

import { AUTH_URL } from '../lib/api';
import { clearMustChangePasswordOverride } from '../lib/auth';

interface LoginPageProps {
  onLoginSuccess: (data: unknown) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const sesionExpirada = new URLSearchParams(window.location.search).get('expired') === 'true';
  const [vistaLogin, setVistaLogin] = useState<'login' | 'recuperar'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Credenciales invalidas');
        return;
      }

      clearMustChangePasswordOverride();
      sessionStorage.setItem('access_token', data.access_token || data.sesion.access_token);
      sessionStorage.setItem('refresh_token', data.refresh_token || data.sesion.refresh_token);
      sessionStorage.setItem('expires_at', String(data.expires_at || data.sesion?.expires_at || 0));

      onLoginSuccess(data);
    } catch {
      setError('Error de conexion con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarPassword = async () => {
    if (!emailRecuperar) return;
    setEnviandoRecuperar(true);
    setError('');

    try {
      await fetch(`${AUTH_URL}/recuperar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRecuperar }),
      });
      setRecuperarEnviado(true);
    } catch {
      setRecuperarEnviado(true);
    } finally {
      setEnviandoRecuperar(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    if (vistaLogin === 'login') {
      await handleSubmit(e);
      return;
    }

    e.preventDefault();
    await handleRecuperarPassword();
  };

  return (
    <div className="login-page">
      <div className="login-bg-circle login-bg-circle-1" />
      <div className="login-bg-circle login-bg-circle-2" />
      <div className="login-bg-circle login-bg-circle-3" />

      <div className="login-container">
        <div className="login-branding">
          <div className="login-brand-content">
            <div className="login-logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
                <path d="M14 24L21 31L34 17" stroke="#0f1512" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48">
                    <stop stopColor="#3edb9f" />
                    <stop offset="1" stopColor="#8b7af0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="login-brand-title">SisAutomatizacion</h1>
            <p className="login-brand-subtitle">
              Plataforma de automatizaciones inteligente para empresas modernas
            </p>

            <div className="login-features">
              <div className="login-feature-item">
                <div className="login-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span>Aislamiento multi-tenant seguro</span>
              </div>
              <div className="login-feature-item">
                <div className="login-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <span>Motor de automatizaciones con IA</span>
              </div>
              <div className="login-feature-item">
                <div className="login-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <span>Control de tokens y suscripciones</span>
              </div>
            </div>
          </div>

          <p className="login-brand-footer">
            © 2026 SisAutomatizacion - Agencia Distinto
          </p>
        </div>

        <div className="login-form-panel">
          <form className="login-form" onSubmit={(e) => { void handleFormSubmit(e); }} autoComplete="off">
            <div className="login-form-header">
              <h2>{vistaLogin === 'login' ? 'Bienvenido de vuelta' : 'Recuperar contrasena'}</h2>
              <p>
                {vistaLogin === 'login'
                  ? 'Ingresa tus credenciales para acceder al sistema'
                  : 'Ingresa tu email y te enviaremos un link para restablecer tu contrasena'}
              </p>
            </div>

            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            {sesionExpirada && vistaLogin === 'login' && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '10px',
                  color: '#92400e',
                  fontSize: '13px',
                  marginBottom: '16px',
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                Tu sesion expiro. Inicia sesion nuevamente.
              </div>
            )}

            {vistaLogin === 'login' ? (
              <>
                <div className="login-field">
                  <label htmlFor="email">Correo electronico</label>
                  <div className="login-input-wrap">
                    <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      id="email"
                      type="email"
                      placeholder="tu@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="password">Contrasena</label>
                  <div className="login-input-wrap">
                    <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="login-toggle-pw"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={loading}
                >
                  {loading ? <span className="login-spinner" /> : 'Iniciar sesion'}
                </button>

                <p
                  className="login-footer-text"
                  onClick={() => {
                    setError('');
                    setVistaLogin('recuperar');
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  ¿Olvidaste tu contrasena?
                </p>
              </>
            ) : (
              <>
                {!recuperarEnviado ? (
                  <>
                    <div className="login-field">
                      <label htmlFor="emailRecuperar">Correo electronico</label>
                      <div className="login-input-wrap">
                        <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <input
                          id="emailRecuperar"
                          type="email"
                          placeholder="tu@email.com"
                          value={emailRecuperar}
                          onChange={(e) => setEmailRecuperar(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="login-submit"
                      disabled={enviandoRecuperar || !emailRecuperar}
                      onClick={() => void handleRecuperarPassword()}
                    >
                      {enviandoRecuperar ? 'Enviando...' : 'Enviar link de recuperacion'}
                    </button>
                  </>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '40px', margin: '0 0 12px' }}>📧</p>
                    <h3 style={{ color: '#f3f7ff', margin: '0 0 8px' }}>¡Email enviado!</h3>
                    <p style={{ color: '#93a4bf', fontSize: '14px', margin: 0 }}>
                      Revisa tu bandeja de entrada y sigue el link para restablecer tu contrasena.
                    </p>
                  </div>
                )}

                <p
                  className="login-footer-text"
                  onClick={() => {
                    setError('');
                    setRecuperarEnviado(false);
                    setVistaLogin('login');
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  ← Volver al login
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
