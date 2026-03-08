import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

type NivelAlerta = 'informativa' | 'advertencia' | 'critica';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async generarAlerta(
    empresa_id: string,
    mensaje: string,
    nivel: NivelAlerta,
    alerta_config_id?: string,
  ) {
    try {
      const { error } = await this.supabase
        .getAdminClient()
        .from('alertas_generadas')
        .insert({
          empresa_id,
          mensaje,
          nivel,
          leida: false,
          fecha_generada: new Date().toISOString(),
          alerta_config_id: alerta_config_id ?? null,
        });

      if (error) {
        this.logger.error(`Error generando alerta: ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generando alerta: ${message}`);
    }
  }

  async verificarStockBajo(empresa_id: string) {
    try {
      const { data, error } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .select(
          `
            cantidad,
            sucursal_id,
            producto:productos(id, nombre, sku, stock_minimo),
            sucursal:sucursales(nombre)
          `,
        )
        .eq('empresa_id', empresa_id);

      console.log('verificarStockBajo - empresa:', empresa_id);
      console.log('verificarStockBajo - items encontrados:', data?.length);
      console.log('verificarStockBajo - error:', error);
      console.log('verificarStockBajo - primer item:', JSON.stringify(data?.[0]));

      if (error || !data) {
        if (error) {
          this.logger.error(`Error consultando stock bajo: ${error.message}`);
        }
        return;
      }

      for (const item of data) {
        const producto = item.producto as { nombre?: string; stock_minimo?: number } | null;
        const sucursal = item.sucursal as { nombre?: string } | null;
        const stockMinimo = producto?.stock_minimo ?? 0;

        if (stockMinimo > 0 && item.cantidad < stockMinimo) {
          const nivel: NivelAlerta = item.cantidad === 0 ? 'critica' : 'advertencia';
          const mensaje =
            item.cantidad === 0
              ? `Sin stock: ${producto?.nombre} en ${sucursal?.nombre}`
              : `Stock bajo: ${producto?.nombre} en ${sucursal?.nombre} (${item.cantidad} unid, min: ${stockMinimo})`;

          const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: existente, error: existenteError } = await this.supabase
            .getAdminClient()
            .from('alertas_generadas')
            .select('id')
            .eq('empresa_id', empresa_id)
            .eq('mensaje', mensaje)
            .gte('fecha_generada', hace24h)
            .maybeSingle();

          if (existenteError) {
            this.logger.error(`Error verificando alerta existente: ${existenteError.message}`);
            continue;
          }

          if (!existente) {
            await this.generarAlerta(empresa_id, mensaje, nivel);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error verificando stock bajo: ${message}`);
    }
  }

  /**
   * Crea una alerta para el admin_empresa cuando un encargado
   * realiza un ajuste manual de stock en su sucursal.
   */
  async createAjusteStockAlert(params: {
    empresaId: string;
    sucursalId: string;
    sucursalNombre: string;
    productoNombre: string;
    sku: string;
    cantidadAnterior: number;
    cantidadNueva: number;
    motivo: string;
    encargadoNombre: string;
    encargadoEmail: string;
  }): Promise<void> {
    const {
      empresaId,
      sucursalId,
      sucursalNombre,
      productoNombre,
      sku,
      cantidadAnterior,
      cantidadNueva,
      motivo,
      encargadoNombre,
      encargadoEmail,
    } = params;

    const diferencia = cantidadNueva - cantidadAnterior;
    const signo = diferencia >= 0 ? '+' : '';
    const tipo = diferencia >= 0 ? 'incremento' : 'reduccion';

    const { data: admins, error } = await this.supabase
      .getAdminClient()
      .from('usuarios')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('rol', 'admin_empresa');

    if (error || !admins?.length) return;

    const alertasPayload = admins.map((admin) => ({
      empresa_id: empresaId,
      usuario_id: admin.id,
      tipo: 'ajuste_stock_manual',
      titulo: `Ajuste manual de stock en ${sucursalNombre}`,
      mensaje: `${encargadoNombre} (${encargadoEmail}) ajusto el stock de "${productoNombre}" (SKU: ${sku}) en ${sucursalNombre}. Cambio: ${cantidadAnterior} -> ${cantidadNueva} (${signo}${diferencia} unidades, ${tipo}). Motivo: "${motivo}".`,
      metadata: {
        sucursal_id: sucursalId,
        sucursal_nombre: sucursalNombre,
        sku,
        producto_nombre: productoNombre,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        diferencia,
        motivo,
        encargado_email: encargadoEmail,
      },
      leida: false,
      created_at: new Date().toISOString(),
    }));

    await this.supabase.getAdminClient().from('alertas').insert(alertasPayload);
  }

  async marcarLeida(empresa_id: string, alerta_id: string) {
    const { error } = await this.supabase
      .getAdminClient()
      .from('alertas_generadas')
      .update({ leida: true })
      .eq('id', alerta_id)
      .eq('empresa_id', empresa_id);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  async marcarTodasLeidas(empresa_id: string) {
    const { error } = await this.supabase
      .getAdminClient()
      .from('alertas_generadas')
      .update({ leida: true })
      .eq('empresa_id', empresa_id)
      .eq('leida', false);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }
}
