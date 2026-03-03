import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const configuredOrigins = [
    process.env.ALLOWED_ORIGIN,
    ...(process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? []),
    'https://sistema-automatizaciones-prod.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
].filter((value): value is string => Boolean(value));

function resolveAllowedOrigin(request: NextRequest): string | null {
    const requestOrigin = request.headers.get('origin');

    if (!requestOrigin) {
        // Request server-to-server o health check sin Origin
        return configuredOrigins[0] ?? null;
    }

    if (configuredOrigins.includes(requestOrigin)) {
        return requestOrigin;
    }

    return null;
}

function withCorsHeaders(response: NextResponse, allowedOrigin: string | null): NextResponse {
    if (!allowedOrigin) {
        return response;
    }

    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-empresa-id');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');

    return response;
}

export function middleware(request: NextRequest) {
    const allowedOrigin = resolveAllowedOrigin(request);

    if (request.method === 'OPTIONS') {
        if (!allowedOrigin) {
            return NextResponse.json(
                { message: 'Origen no permitido por CORS' },
                { status: 403 },
            );
        }

        return withCorsHeaders(new NextResponse(null, { status: 204 }), allowedOrigin);
    }

    return withCorsHeaders(NextResponse.next(), allowedOrigin);
}

export const config = {
    matcher: ['/api/:path*', '/auth/:path*', '/notificaciones/:path*'],
};
