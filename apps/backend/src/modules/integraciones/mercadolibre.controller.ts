import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
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
import { SupabaseService } from '../../shared/supabase/supabase.service';

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
    private readonly supabase: SupabaseService,
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
      const { data: integracion, error: selectError } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .select('id, activa')
        .eq('empresa_id', empresa_id)
        .eq('tipo_integracion', 'mercadolibre')
        .maybeSingle();

      if (selectError) {
        throw new InternalServerErrorException(
          `Error al consultar integracion de Mercado Libre: ${selectError.message}`,
        );
      }

      if (!integracion?.id || !integracion.activa) {
        throw new BadRequestException('Mercado Libre no esta conectado para esta empresa');
      }

      const nowIso = new Date().toISOString();
      const { error: updateError } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .update({ ultima_sincronizacion: nowIso })
        .eq('id', integracion.id);

      if (updateError) {
        throw new InternalServerErrorException(
          `Error al registrar sync manual de Mercado Libre: ${updateError.message}`,
        );
      }

      this.logger.log(`[sync-manual] Mercado Libre solicitado empresa=${empresa_id}`);
      return {
        ok: true,
        empresa_id,
        tipo: tipoNormalizado,
        mensaje: 'Sync manual de Mercado Libre registrado',
      };
    }

    throw new BadRequestException(`Tipo de integracion no soportado: ${tipoNormalizado}`);
  }
}
