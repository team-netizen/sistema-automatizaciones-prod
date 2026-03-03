import { NextRequest, NextResponse } from 'next/server';
import { testAsignarSucursalHibrido } from '@/services/testAsignacion';

/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/debug/test-asignacion/[pedidoId]
 * ═══════════════════════════════════════════════════════════
 * Endpoint de depuración para simular la asignación híbrida.
 * No realiza cambios en la base de datos (solo lectura de lógica).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ pedidoId: string }> }
) {
    // Solo permitir en desarrollo (puedes ajustar esta lógica según tus env vars)
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Endpoint no disponible en producción' }, { status: 403 });
    }

    try {
        const { pedidoId } = await params;

        if (!pedidoId) {
            return NextResponse.json({ error: 'ID de pedido no proporcionado' }, { status: 400 });
        }

        const result = await testAsignarSucursalHibrido(pedidoId);

        return NextResponse.json(result, { status: result.success ? 200 : 500 });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
