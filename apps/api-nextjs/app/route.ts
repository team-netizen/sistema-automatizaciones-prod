/**
 * GET /api → Health check del API Gateway
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    servicio: 'API Gateway - Sistema de Automatizaciones',
    estado: 'activo',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
