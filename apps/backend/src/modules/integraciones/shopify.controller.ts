import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { EmpresaGuard } from '../../core/auth/empresa.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { type PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { ShopifyService } from './shopify.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

type ShopifyAuthBody = {
  empresa_id?: string;
  shop_url: string;
  api_key: string;
  api_secret: string;
};

type ShopifyCallbackRawQuery = Record<string, string | string[] | undefined>;

type ShopifyCallbackQuery = Record<string, string | undefined>;

function normalizeQuery(query: ShopifyCallbackRawQuery): ShopifyCallbackQuery {
  return Object.entries(query).reduce<ShopifyCallbackQuery>((acc, [key, value]) => {
    acc[key] = Array.isArray(value) ? value[0] : value;
    return acc;
  }, {});
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Controller('integraciones')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly shopifyService: ShopifyService,
  ) {}

  @Post('shopify/auth-url')
  @UseGuards(RolesGuard, EmpresaGuard)
  @Roles('admin_empresa', 'super_admin')
  async getAuthUrl(
    @Body() body: ShopifyAuthBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const empresaId = this.resolveEmpresaId(req, body?.empresa_id);
    return this.shopifyService.getAuthUrl(empresaId, body);
  }

  @Post('shopify/credenciales')
  @UseGuards(RolesGuard, EmpresaGuard)
  @Roles('admin_empresa', 'super_admin')
  async guardarCredencialesShopify(
    @Body() body: ShopifyAuthBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const empresaId = this.resolveEmpresaId(req, body?.empresa_id);
    return this.shopifyService.getAuthUrl(empresaId, body);
  }

  @Get('shopify/callback')
  async oauthCallback(
    @Query() rawQuery: ShopifyCallbackRawQuery,
    @Res() res: Response,
  ) {
    const query = normalizeQuery(rawQuery);
    const { code, shop, state, hmac } = query;

    this.logger.log(`[Shopify callback] shop=${shop || 'missing'} state=${state || 'missing'}`);

    try {
      await this.shopifyService.handleCallback(
        code ?? '',
        shop ?? '',
        state ?? '',
        hmac ?? '',
        query,
      );

      return res.status(HttpStatus.OK).send(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>OAuth Shopify</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #0b0f12; color: #e8f5ee; }
              .card { max-width: 520px; margin: 24px auto; border: 1px solid #1c2830; border-radius: 10px; background: #0f1419; padding: 18px; }
            </style>
          </head>
          <body>
            <div class="card">
              <p>Shopify conectado. Cerrando ventana...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage('shopify-connected', '*');
                window.opener.postMessage('shopify-oauth-complete', '*');
              }
              setTimeout(function () { window.close(); }, 1000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error conectando Shopify';
      const safeMessage = escapeHtml(message);

      return res.status(HttpStatus.BAD_REQUEST).send(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>OAuth Shopify</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #0b0f12; color: #e8f5ee; }
              .card { max-width: 520px; margin: 24px auto; border: 1px solid #3f1d1d; border-radius: 10px; background: #1a0f0f; padding: 18px; }
            </style>
          </head>
          <body>
            <div class="card">
              <p>Error conectando Shopify: ${safeMessage}</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage('shopify-error', '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  }

  @Get('shopify/estado/:empresaId')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  async getEstado(
    @Param('empresaId') empresaId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const empresaAutorizada = this.resolveEmpresaId(req, empresaId);
    return this.shopifyService.getEstado(empresaAutorizada);
  }

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

  private resolveEmpresaId(req: AuthenticatedRequest, candidate?: string): string {
    const requested = String(candidate ?? '').trim();
    const perfilEmpresaId = String(req?.perfil?.empresa_id ?? '').trim();

    if (req?.perfil?.rol === 'super_admin') {
      const empresaId = requested || perfilEmpresaId;
      if (!empresaId) {
        throw new ForbiddenException('super_admin debe especificar empresa_id');
      }
      return empresaId;
    }

    if (!perfilEmpresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }

    if (requested && requested !== perfilEmpresaId) {
      throw new ForbiddenException('empresa_id no autorizado');
    }

    return perfilEmpresaId;
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
