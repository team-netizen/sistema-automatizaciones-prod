import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Controller('integraciones')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Post('shopify/webhook/:empresa_id')
  @HttpCode(HttpStatus.OK)
  async webhookShopify(
    @Param('empresa_id') empresa_id: string,
    @Body() body: any,
    @Headers('x-shopify-hmac-sha256') hmac: string,
  ) {
    const secret = await this.obtenerApiSecret(empresa_id);
    if (secret) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body || {});
      const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
      if (!hmac || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac))) {
        throw new UnauthorizedException('Firma Shopify invalida');
      }
    }

    this.logger.log(`Shopify webhook recibido para empresa ${empresa_id}`);
    return { received: true };
  }

  private async obtenerApiSecret(empresa_id: string): Promise<string | null> {
    const { data } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('credenciales')
      .eq('empresa_id', empresa_id)
      .eq('tipo_integracion', 'shopify')
      .eq('activa', true)
      .maybeSingle();

    const credenciales = (data?.credenciales || {}) as Record<string, unknown>;
    const secret = credenciales.api_secret;
    return typeof secret === 'string' && secret.trim() ? secret.trim() : null;
  }
}
