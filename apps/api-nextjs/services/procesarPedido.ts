import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * Definición de ítem de pedido para el servicio
 */
export interface PedidoItemSimple {
    productoId: string;
    sku_producto?: string; // Nuevo campo
    cantidad: number;
    precioUnitario: number;
}

/**
 * Parámetros para procesar un pedido (WooCommerce / Otros medios)
 */
export interface ProcesarPedidoParams {
    empresaId: string;
    sucursalId: string;
    canalId: string;
    idExterno: string; // ID único del origen (ej: WC order id)
    numeroPedido: string; // Número visible del pedido
    total: number;
    items: PedidoItemSimple[];
    usuarioSistemaId: string | null;

    // Nuevos campos solicitados
    id_orden: string;
    medio_pedido: "web" | "wsp" | "fisico";
    cliente_id?: string | null;
    metodo_pago?: string | null;
    direccion_cliente?: string | null;
    distrito_cliente?: string | null;
    provincia_cliente?: string | null;
    dni_cliente?: string | null;
    fecha_pedido?: string | null;
}

/**
 * Valida si existe stock suficiente disponible (cantidad - reservada)
 */
async function validarStock(
    empresaId: string,
    sucursalId: string,
    productoId: string,
    cantidadRequerida: number
): Promise<{ valida: boolean; disponible?: number; nombre?: string }> {
    const { data: producto } = await supabaseAdmin
        .from("productos")
        .select("nombre")
        .eq("id", productoId)
        .single();

    const { data: stock } = await supabaseAdmin
        .from("stock_por_sucursal")
        .select("cantidad, cantidad_reservada")
        .eq("empresa_id", empresaId)
        .eq("sucursal_id", sucursalId)
        .eq("producto_id", productoId)
        .maybeSingle();

    if (!stock) return { valida: false, nombre: producto?.nombre || "Producto desconocido" };

    const disponible = stock.cantidad - (stock.cantidad_reservada || 0);
    return {
        valida: disponible >= cantidadRequerida,
        disponible,
        nombre: producto?.nombre || "Producto desconocido",
    };
}

/**
 * SERVICIO: Procesar Pedido
 *
 * Este servicio centraliza el flujo de creación de pedidos.
 * Utiliza una función RPC transaccional en la base de datos para asegurar:
 * 1. La creación del pedido y sus ítems.
 * 2. La validación y descuento de stock en un solo paso atómico.
 */
export async function procesarPedido({
    empresaId,
    sucursalId,
    canalId,
    idExterno,
    numeroPedido,
    total,
    items,
    usuarioSistemaId,
    id_orden,
    medio_pedido,
    cliente_id,
    metodo_pago,
    direccion_cliente,
    distrito_cliente,
    provincia_cliente,
    dni_cliente,
    fecha_pedido,
}: ProcesarPedidoParams) {
    try {
        console.log(
            `[SERVICIO_PEDIDO] Iniciando procesamiento: ${numeroPedido} (Medio: ${medio_pedido})`
        );

        // 1. Validar duplicidad externa (Idempotencia)
        const { data: pedidoExistente, error: checkError } = await supabaseAdmin
            .from("pedidos")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("id_externo", idExterno)
            .maybeSingle();

        if (checkError) throw new Error(`Error de validación: ${checkError.message}`);

        if (pedidoExistente) {
            console.log(`[SERVICIO_PEDIDO] Pedido ${idExterno} ya existe. Ignorando.`);
            return {
                success: true,
                status: "duplicate",
                message: "Pedido ya procesado.",
                duplicado: true,
                pedidoId: pedidoExistente.id,
            };
        }

        // ─── 2. VALIDACIÓN DE STOCK (Pre-check) ──────────────────────────
        console.log(`[SERVICIO_PEDIDO] Validando stock para ${items.length} ítems...`);
        for (const item of items) {
            const v = await validarStock(empresaId, sucursalId, item.productoId, item.cantidad);
            if (!v.valida) {
                throw new Error(
                    `Stock insuficiente para "${v.nombre}". Disponible: ${v.disponible}, Requerido: ${item.cantidad}`
                );
            }
        }

        // 3. Mapear ítems para formato de base de datos
        const itemsMapped = items.map((item) => ({
            producto_id: item.productoId,
            sku_producto: item.sku_producto || "",
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
        }));

        // 4. Ejecutar Transacción Maestro-Detalle + Stock (RPC)
        // El RPC implementa: VALIDAR -> RESERVAR -> INSERTAR -> DESCONTAR/LIBERAR
        const { data: pedidoId, error: rpcError } = await supabaseAdmin.rpc(
            "crear_pedido_transaccional",
            {
                p_empresa_id: empresaId,
                p_sucursal_id: sucursalId,
                p_canal_id: canalId,
                p_numero: numeroPedido,
                p_total: total,
                p_id_externo: idExterno,
                p_id_orden: id_orden,
                p_medio_pedido: medio_pedido,
                p_id_cliente: cliente_id || null,
                p_metodo_pago: metodo_pago || null,
                p_direccion_cliente: direccion_cliente || null,
                p_distrito_cliente: distrito_cliente || null,
                p_provincia_cliente: provincia_cliente || null,
                p_dni_cliente: dni_cliente || null,
                p_fecha_pedido: fecha_pedido || null,
                p_items: itemsMapped,
                p_usuario_id: usuarioSistemaId,
            }
        );

        if (rpcError) {
            console.error(`[SERVICIO_PEDIDO] Error de base de datos: ${rpcError.message}`);
            throw new Error(rpcError.message);
        }

        // 4. Obtener el pedido completo para retornar (incluyendo items)
        const { data: pedidoCompleto } = await supabaseAdmin
            .from("pedidos")
            .select("*, pedido_items(*)")
            .eq("id", pedidoId)
            .single();

        return {
            success: true,
            pedidoId,
            data: pedidoCompleto,
        };
    } catch (error: any) {
        console.error(`[SERVICIO_PEDIDO] [FALLO] ${error.message}`);
        throw new Error(error.message || "Error al procesar el pedido.");
    }
}
