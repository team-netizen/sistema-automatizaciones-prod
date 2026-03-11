import {
  BadRequestException,
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
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import type { Request, Response } from 'express';
import { Roles } from '../../core/auth/roles.decorator';
import { type PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { MercadoLibreService } from './mercadolibre.service';
import { ShopifyService } from './shopify.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

type WooSyncJobData = {
  empresa_id: string;
  manual?: boolean;
  lookback_days?: number;
};

@Controller('integraciones')
export class MercadoLibreController {
  private readonly logger = new Logger(MercadoLibreController.name);

  constructor(
    private readonly mercadoLibreService: MercadoLibreService,
    private readonly shopifyService: ShopifyService,
    @InjectQueue('woocommerce-sync')
    private readonly wooQueue: Queue<WooSyncJobData>,
  ) {}

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
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    this.logger.log(`[ML callback] code=${code ? 'present' : 'missing'} state=${state || 'missing'}`);
    await this.mercadoLibreService.handleCallback(code, state);

    return res.status(HttpStatus.OK).send(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>OAuth Mercado Libre</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #0b0f12; color: #e8f5ee; }
            .card { max-width: 520px; margin: 24px auto; border: 1px solid #1c2830; border-radius: 10px; background: #0f1419; padding: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <p>Autorizacion completada. Cerrando ventana...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage('ml-oauth-complete', '*');
            }
            setTimeout(function () { window.close(); }, 1000);
          </script>
        </body>
      </html>
    `);
  }

  @Post(':tipo/sync-manual')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async syncManual(
    @Param('tipo') tipo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const empresa_id = req?.perfil?.empresa_id;
    if (!empresa_id) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }

    const tipoNormalizado = String(tipo ?? '').trim().toLowerCase();
    if (tipoNormalizado === 'woocommerce') {
      const jobs = await Promise.all([
        this.wooQueue.add(
          'sync-stock',
          { empresa_id },
          {
            jobId: `woocommerce-${empresa_id}-sync-stock-manual-${Date.now()}`,
            removeOnComplete: true,
          },
        ),
        this.wooQueue.add(
          'sync-pedidos',
          { empresa_id, manual: true, lookback_days: 30 },
          {
            jobId: `woocommerce-${empresa_id}-sync-pedidos-manual-${Date.now()}`,
            removeOnComplete: true,
          },
        ),
      ]);

      return {
        ok: true,
        empresa_id,
        tipo: tipoNormalizado,
        jobs: jobs.map((job: Job<WooSyncJobData>) => ({ id: job.id, name: job.name })),
      };
    }

    if (tipoNormalizado === 'mercadolibre') {
      this.logger.log(`[sync-manual] Mercado Libre solicitado empresa=${empresa_id}`);
      const resultado = await this.mercadoLibreService.syncManual(empresa_id);
      return {
        ok: true,
        empresa_id,
        tipo: tipoNormalizado,
        ...resultado,
      };
    }

    if (tipoNormalizado === 'shopify') {
      this.logger.log(`[sync-manual] Shopify solicitado empresa=${empresa_id}`);
      const resultado = await this.shopifyService.syncManual(empresa_id);
      return {
        ok: true,
        empresa_id,
        tipo: tipoNormalizado,
        ...resultado,
      };
    }

    throw new BadRequestException(`Tipo de integracion no soportado: ${tipoNormalizado}`);
  }
}
