import { supabaseAdmin } from '@/lib/supabaseServer';
import { calcularDistanciaHaversine } from '@/utils/distancia.util';
import { logger } from '@/lib/logger';

const LOG_CONTEXT = 'ASIGNACION'; // Ajustado a [ASIGNACION] según requerimiento

/**
 * SERVICIO: Asignar Sucursal Híbrido
 * 
 * Este servicio implementa la lógica de asignación inteligente de pedidos
 * basándose en stock completo, distancia geográfica y prioridad de sucursal.
 */
export async function asignarSucursalHibrido(pedidoId: string) {
    try {
        // PASO 1: Obtener pedido con detalles y coordenadas cliente
        const { data: pedido, error: pedidoError } = await supabaseAdmin
            .from('pedidos')
            .select(`
                id, 
                empresa_id, 
                latitud_cliente, 
                longitud_cliente, 
                estado,
                procesado,
                pedido_items (
                    producto_id,
                    cantidad
                ),
                empresas!inner (
                    modo_asignacion_pedidos
                )
            `)
            .eq('id', pedidoId)
            .single();

        if (pedidoError || !pedido) {
            throw new Error(`Pedido no encontrado: ${pedidoError?.message || 'ID inválido'}`);
        }

        const empresaId = pedido.empresa_id;

        // Log: [ASIGNACION] Pedido X iniciado
        logger.info(LOG_CONTEXT, `Pedido ${pedidoId} iniciado`, { empresaId });

        // PROTECCIÓN DE CONCURRENCIA: Verificar si ya fue procesado (Optimista)
        if (pedido.procesado) {
            logger.info(LOG_CONTEXT, `Pedido ya procesado (verificación optimista). Saltando.`, {
                pedido_id: pedidoId,
                empresa_id: empresaId
            });
            return { success: true, message: 'El pedido ya fue procesado', status: 'already_processed' };
        }

        // Validación Mandataria: Solo ejecutar si modo_asignacion_pedidos = "hibrido"
        const modoAsignacion = (pedido.empresas as any)?.modo_asignacion_pedidos;
        if (modoAsignacion !== 'hibrido') {
            logger.warn(LOG_CONTEXT, `Saltando: El modo de asignación de la empresa es ${modoAsignacion}`, {
                pedido_id: pedidoId,
                empresa_id: empresaId
            });
            return { success: false, message: 'La empresa no está configurada para asignación híbrida' };
        }

        // Validar coordenadas del cliente
        if (pedido.latitud_cliente === null || pedido.longitud_cliente === null) {
            throw new Error('El pedido no tiene coordenadas (lat/lng) para el cálculo de distancia');
        }

        // PASO 2: Obtener sucursales candidatas (empresa_id, permite_despacho = true)
        const { data: sucursales, error: sucursalesError } = await supabaseAdmin
            .from('sucursales')
            .select('id, nombre, latitud, longitud, prioridad_despacho')
            .eq('empresa_id', empresaId)
            .eq('permite_despacho', true)
            .eq('activa', true);

        if (sucursalesError || !sucursales || sucursales.length === 0) {
            throw new Error('No se encontraron sucursales activas configuradas para despacho');
        }

        // PASO 3: Filtrar solo sucursales con stock COMPLETO para todos los ítems
        const itemsPedido = (pedido as any).pedido_items;
        const sucursalIds = sucursales.map(s => s.id);
        const productoIds = itemsPedido.map((i: any) => i.producto_id);

        const { data: allInventarios, error: invError } = await supabaseAdmin
            .from('stock_por_sucursal')
            .select('sucursal_id, producto_id, cantidad, cantidad_reservada')
            .in('sucursal_id', sucursalIds)
            .in('producto_id', productoIds);

        if (invError) throw new Error(`Error al consultar stock: ${invError.message}`);

        const sucursalesConStock = [];

        for (const sucursal of sucursales) {
            let tieneStockCompleto = true;

            for (const item of itemsPedido) {
                const stockItem = allInventarios?.find(
                    inv => inv.sucursal_id === sucursal.id && inv.producto_id === item.producto_id
                );

                const stockDisponible = stockItem ? (stockItem.cantidad - (stockItem.cantidad_reservada || 0)) : 0;

                if (!stockItem || stockDisponible < item.cantidad) {
                    tieneStockCompleto = false;
                    break;
                }
            }

            if (tieneStockCompleto) {
                // PASO 4: Calcular distancia usando Haversine
                const distancia = calcularDistanciaHaversine(
                    Number(pedido.latitud_cliente),
                    Number(pedido.longitud_cliente),
                    Number(sucursal.latitud),
                    Number(sucursal.longitud)
                );

                // Log: Por cada sucursal evaluada (OK)
                logger.info(LOG_CONTEXT, `Evaluando sucursal: ${sucursal.nombre}`, {
                    pedido_id: pedidoId,
                    empresa_id: empresaId,
                    distancia: `${distancia.toFixed(2)}km`,
                    stock: 'OK'
                });

                sucursalesConStock.push({
                    ...sucursal,
                    distancia
                });
            } else {
                // Log: Por cada sucursal evaluada (INSUFICIENTE)
                logger.warn(LOG_CONTEXT, `Evaluando sucursal: ${sucursal.nombre}`, {
                    pedido_id: pedidoId,
                    empresa_id: empresaId,
                    stock: 'INSUFICIENTE'
                });
            }
        }

        if (sucursalesConStock.length === 0) {
            // Log: [ASIGNACION] Sin stock completo
            logger.error(LOG_CONTEXT, `Sin stock completo`, {
                pedido_id: pedidoId,
                empresa_id: empresaId
            });
            return { success: false, message: 'Sin stock suficiente en ninguna sucursal válida' };
        }

        // PASO 5: Ordenar por menor distancia y luego por menor prioridad_despacho
        sucursalesConStock.sort((a, b) => {
            if (a.distancia !== b.distancia) {
                return a.distancia - b.distancia;
            }
            return (a.prioridad_despacho || 99) - (b.prioridad_despacho || 99);
        });

        // PASO 6: Seleccionar la mejor opción
        const sucursalElegida = sucursalesConStock[0];

        // Log: [ASIGNACION] Sucursal seleccionada: X
        logger.info(LOG_CONTEXT, `Sucursal seleccionada: ${sucursalElegida.nombre}`, {
            pedido_id: pedidoId,
            empresa_id: empresaId,
            distancia: `${sucursalElegida.distancia.toFixed(2)}km`
        });

        // PASO 7: Ejecutar Transacción vía RPC
        const { data: updateSuccess, error: updateError } = await supabaseAdmin.rpc('asignar_pedido_hibrido_v1', {
            p_pedido_id: pedido.id,
            p_sucursal_id: sucursalElegida.id,
            p_empresa_id: empresaId
        });

        if (updateError) {
            // PROTECCIÓN DE CONCURRENCIA: Validar error lanzado por el SELECT FOR UPDATE (Pesimista)
            if (updateError.message.includes('ALREADY_PROCESSED')) {
                logger.info(LOG_CONTEXT, `Pedido ya procesado (verificación transaccional). Saltando.`, {
                    pedido_id: pedidoId,
                    empresa_id: empresaId
                });
                return { success: true, message: 'El pedido ya fue procesado', status: 'already_processed' };
            }
            throw new Error(`Error al ejecutar transacción de asignación: ${updateError.message}`);
        }

        return {
            success: true,
            status: 'processed',
            sucursalId: sucursalElegida.id,
            distanciaKm: sucursalElegida.distancia
        };

    } catch (error: any) {
        logger.error(LOG_CONTEXT, `Fallo en el proceso de asignación`, {
            pedido_id: pedidoId,
            message: error.message
        });
        return { success: false, error: error.message };
    }
}
