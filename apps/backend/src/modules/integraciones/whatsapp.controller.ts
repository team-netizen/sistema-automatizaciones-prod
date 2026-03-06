import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Controller('integraciones')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Get('whatsapp/webhook/:empresa_id')
  @HttpCode(HttpStatus.OK)
  async verificarWebhookWA(
    @Param('empresa_id') empresa_id: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const tokenGuardado = await this.obtenerVerifyToken(empresa_id);

    if (mode === 'subscribe' && tokenGuardado && token === tokenGuardado) {
      return challenge;
    }

    throw new ForbiddenException('Token invalido');
  }

  @Post('whatsapp/webhook/:empresa_id')
  @HttpCode(HttpStatus.OK)
  async webhookWA(
    @Param('empresa_id') empresa_id: string,
    @Body() body: any,
  ) {
    this.logger.log(`WA webhook recibido para empresa ${empresa_id}: ${JSON.stringify(body)}`);
    return { received: true };
  }

  private async obtenerVerifyToken(empresa_id: string): Promise<string | null> {
    const { data } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('credenciales')
      .eq('empresa_id', empresa_id)
      .eq('tipo_integracion', 'whatsapp')
      .eq('activa', true)
      .maybeSingle();

    const credenciales = (data?.credenciales || {}) as Record<string, unknown>;
    const token = credenciales.verify_token;
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  }
}
