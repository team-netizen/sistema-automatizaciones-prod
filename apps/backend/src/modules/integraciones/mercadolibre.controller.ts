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
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import type { Request } from 'express';
import { Roles } from '../../core/auth/roles.decorator';
import { type PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { MercadoLibreService } from './mercadolibre.service';

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
  @HttpCode(HttpStatus.OK)
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    this.logger.log(`[ML callback] code=${code ? 'present' : 'missing'} state=${state || 'missing'}`);
    return this.mercadoLibreService.handleCallback(code, state);
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

    throw new BadRequestException(`Tipo de integracion no soportado: ${tipoNormalizado}`);
  }
}
