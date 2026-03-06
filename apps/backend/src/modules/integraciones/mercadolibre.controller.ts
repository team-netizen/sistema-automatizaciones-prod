import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, Post, Query } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Controller('integraciones')
export class MercadoLibreController {
  private readonly logger = new Logger(MercadoLibreController.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Post('mercadolibre/webhook/:empresa_id')
  @HttpCode(HttpStatus.OK)
  async webhookML(
    @Param('empresa_id') empresa_id: string,
    @Body() body: any,
  ) {
    this.logger.log(`ML webhook recibido para empresa ${empresa_id}: ${JSON.stringify(body)}`);
    return { received: true };
  }

  @Get('mercadolibre/callback')
  @HttpCode(HttpStatus.OK)
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (code && state) {
      const { data: current } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .select('id, credenciales')
        .eq('empresa_id', state)
        .eq('tipo_integracion', 'mercadolibre')
        .maybeSingle();

      if (current?.id) {
        const credenciales = {
          ...((current.credenciales || {}) as Record<string, unknown>),
          oauth_code: code,
          oauth_code_fecha: new Date().toISOString(),
        };

        await this.supabase
          .getAdminClient()
          .from('integraciones_canal')
          .update({ credenciales })
          .eq('id', current.id);
      }
    }

    return { message: 'Autorizacion exitosa, puedes cerrar esta ventana' };
  }
}
