import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // [SECURITY FIX] Mitiga clickjacking.
          { key: 'X-Frame-Options', value: 'DENY' },
          // [SECURITY FIX] Evita MIME sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // [SECURITY FIX] Habilita proteccion XSS en navegadores heredados.
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // [SECURITY FIX] Fuerza HTTPS en navegadores compatibles.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // [SECURITY FIX] Reduce exposicion de referrer.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // [SECURITY FIX] CSP base para limitar origenes de carga.
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
