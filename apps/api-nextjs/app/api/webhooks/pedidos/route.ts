import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { procesarPedido, type ProcesarPedidoParams } from '@/services/procesarPedido';

function isValidApiKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expectedApiKey = process.env.WEBHOOK_API_KEY?.trim() || '';
  const providedApiKey = req.headers.get('x-api-key')?.trim() || '';

  // [SECURITY FIX] La sola presencia de header no autentica; validar secreto compartido.
  if (!expectedApiKey || !providedApiKey || !isValidApiKey(providedApiKey, expectedApiKey)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};

    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
    }

    const empresaId = String(body.empresa_id ?? '');
    const sucursalId = String(body.sucursal_id ?? '');
    const canalId = String(body.canal_id ?? 'manual');
    const idExterno = String(body.id ?? '');

    if (!empresaId || !sucursalId || !idExterno) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: empresa_id, sucursal_id, id' },
        { status: 400 },
      );
    }

    const payload: ProcesarPedidoParams = {
      empresaId,
      sucursalId,
      canalId,
      idExterno,
      numeroPedido: String(body.number ?? idExterno),
      total: parseFloat(String(body.total ?? '0')),
      items: [],
      usuarioSistemaId: null,
      id_orden: idExterno,
      medio_pedido: 'web',
    };

    const result = await procesarPedido(payload);

    const httpStatus = result.status === 'processed' ? 201 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch {
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        message: 'Error interno del servidor.',
      },
      { status: 500 },
    );
  }
}

export const maxDuration = 60;
