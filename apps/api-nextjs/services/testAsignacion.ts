import { supabaseAdmin } from '@/lib/supabaseServer';
import { calcularDistanciaHaversine } from '@/utils/distancia.util';

/**
 * SERVICIO: Test Asignación Híbrida (Simulación)
 * 
 * Este servicio permite visualizar cómo se asignaría un pedido sin afectar el stock real.
 */
export async function testAsignarSucursalHibrido(pedidoId: string) {
    const logs: string[] = [];
    const sucursalesEvaluadas: any[] = [];

    const addLog = (msg: string) => {
        const timestamp = new Date().toISOString();
        const formattedMsg = `[DEBUG_TEST] ${msg}`;
        logs.push(`${timestamp}: ${formattedMsg}`);
        console.log(formattedMsg);
    };

    try {
        addLog(`Iniciando simulación para pedido: ${pedidoId}`);

        // 1. Obtener pedido
        const { data: pedido, error: pedidoError } = await supabaseAdmin
            .from('pedidos')
            .select(`
                id, 
                empresa_id, 
                latitud_cliente, 
                longitud_cliente, 
                estado,
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

        const modoAsignacion = (pedido.empresas as any)?.modo_asignacion_pedidos;
        addLog(`Modo de asignación de empresa: ${modoAsignacion}`);

        if (pedido.latitud_cliente === null || pedido.longitud_cliente === null) {
            addLog(`ERROR: Pedido sin coordenadas del cliente.`);
            return { success: false, error: 'Pedido sin coordenadas', logs };
        }

        // 2. Obtener sucursales
        const { data: sucursales, error: sucursalesError } = await supabaseAdmin
            .from('sucursales')
            .select('id, nombre, latitud, longitud, prioridad_despacho, permite_despacho, activa')
            .eq('empresa_id', pedido.empresa_id);

        if (sucursalesError || !sucursales) {
            throw new Error('Error al obtener sucursales');
        }

        // 3. Evaluar cada sucursal
        const itemsPedido = (pedido as any).pedido_items;
        const sucursalIds = sucursales.map(s => s.id);
        const productoIds = itemsPedido.map((i: any) => i.producto_id);

        const { data: allInventarios } = await supabaseAdmin
            .from('stock_por_sucursal')
            .select('sucursal_id, producto_id, cantidad, cantidad_reservada')
            .in('sucursal_id', sucursalIds)
            .in('producto_id', productoIds);

        for (const sucursal of sucursales) {
            let motivoDescarte: string | null = null;
            let distancia: number | null = null;

            if (!sucursal.activa) motivoDescarte = 'Sucursal inactiva';
            else if (!sucursal.permite_despacho) motivoDescarte = 'No permite despacho';
            else {
                // Validar Stock
                for (const item of itemsPedido) {
                    const stockItem = allInventarios?.find(
                        inv => inv.sucursal_id === sucursal.id && inv.producto_id === item.producto_id
                    );
                    const stockDisponible = stockItem ? (stockItem.cantidad - (stockItem.cantidad_reservada || 0)) : 0;
                    if (!stockItem || stockDisponible < item.cantidad) {
                        motivoDescarte = `Stock insuficiente para producto ${item.producto_id} (Disp: ${stockDisponible}, Req: ${item.cantidad})`;
                        break;
                    }
                }
            }

            if (!motivoDescarte) {
                distancia = calcularDistanciaHaversine(
                    Number(pedido.latitud_cliente),
                    Number(pedido.longitud_cliente),
                    Number(sucursal.latitud),
                    Number(sucursal.longitud)
                );
            }

            sucursalesEvaluadas.push({
                nombre: sucursal.nombre,
                id: sucursal.id,
                apta: !motivoDescarte,
                motivoDescarte,
                distancia,
                prioridad: sucursal.prioridad_despacho
            });
        }

        // 4. Ordenar y elegir
        const candidatas = sucursalesEvaluadas
            .filter(s => s.apta)
            .sort((a, b) => {
                if (a.distancia !== b.distancia) return a.distancia! - b.distancia!;
                return (a.prioridad || 99) - (b.prioridad || 99);
            });

        const elegida = candidatas.length > 0 ? candidatas[0] : null;

        if (elegida) {
            addLog(`SIMULACIÓN EXITOSA. Ganadora: ${elegida.nombre} a ${elegida.distancia?.toFixed(2)}km`);
        } else {
            addLog(`SIMULACIÓN FALLIDA: Ninguna sucursal apta.`);
        }

        return {
            success: true,
            simulacion: {
                pedidoId,
                clienteCoords: { lat: pedido.latitud_cliente, lng: pedido.longitud_cliente },
                sucursalSeleccionada: elegida,
                totalEvaluadas: sucursalesEvaluadas.length,
                totalAptas: candidatas.length,
                sucursalesEvaluadas
            },
            logs
        };

    } catch (error: any) {
        addLog(`ERROR CRÍTICO: ${error.message}`);
        return { success: false, error: error.message, logs };
    }
}
