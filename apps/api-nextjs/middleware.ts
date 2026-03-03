import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Obtener el origen permitido desde las variables de entorno
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

    // Manejar preflight requests (OPTIONS)
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-empresa-id',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Continuar con la petición original
    const response = NextResponse.next();

    // Añadir headers de CORS a la respuesta
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-empresa-id');

    return response;
}

// Configurar en qué rutas se aplica el middleware
export const config = {
    matcher: '/api/:path*',
};
