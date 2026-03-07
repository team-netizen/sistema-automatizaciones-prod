import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { AlertasService } from './alertas.service';

type DashboardMetricas = {
  total_productos: number;
  pedidos_mes: number;
  movimientos_recientes: number;
  alertas_activas: number;
  total_productos_criticos: number;
};

type TransferenciaPayload = {
  sucursal_origen_id: string;
  sucursal_destino_id: string;
  notas?: string;
  aprobacion_requerida?: boolean;
  items: Array<{ producto_id: string; cantidad_enviada: number }>;
};

type SucursalPayload = {
  nombre: string;
  tipo?: string;
  estado?: string;
};

@Injectable()
export class OperacionesService {
  private readonly logger = new Logger(OperacionesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly alertasService: AlertasService,
  ) {}

  async getDashboardMetrics(empresa_id: string): Promise<{ metricas: DashboardMetricas }> {
    try {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const [totalProductos, pedidosMes, movimientosRecientes, alertasActivas, productosCriticos] =
        await Promise.all([
          this.countRows('productos', empresa_id),
          this.countRowsWithDateFallback('pedidos', empresa_id, inicioMes.toISOString(), [
            'fecha_creacion',
            'created_at',
            'fecha',
          ]),
          this.countRowsWithDateFallback(
            'movimientos_stock',
            empresa_id,
            hace7Dias.toISOString(),
            ['fecha_creacion', 'created_at', 'fecha'],
          ),
          this.countRows('alertas_generadas', empresa_id, { leida: false }),
          this.getProductosCriticos(empresa_id),
        ]);

      return {
        metricas: {
          total_productos: totalProductos,
          pedidos_mes: pedidosMes,
          movimientos_recientes: movimientosRecientes,
          alertas_activas: alertasActivas,
          total_productos_criticos: productosCriticos.length,
        },
      };
    } catch (error) {
      this.handleError('getDashboardMetrics', error, 'Error al obtener metricas del dashboard');
    }
  }

  async getProductosCriticos(empresa_id: string): Promise<any[]> {
    try {
      const stockRows = await this.getStockRowsWithFallback(empresa_id);
      if (stockRows.length === 0) return [];

      const productoIds = this.uniqueIds(stockRows, 'producto_id');
      const sucursalIds = this.uniqueIds(stockRows, 'sucursal_id');

      const [productosMap, sucursalesMap] = await Promise.all([
        this.getProductosMap(empresa_id, productoIds),
        this.getSucursalesMap(empresa_id, sucursalIds),
      ]);

      const criticos = stockRows
        .map((row) => {
          const productoId = this.readString(row, 'producto_id');
          if (!productoId) return null;

          const producto = productosMap.get(productoId);
          if (!producto) return null;

          const cantidad = this.readNumber(row, 'cantidad');
          const reservada = this.readNumber(row, 'cantidad_reservada');
          const disponible = cantidad - reservada;

          const stockMinimoRow = this.readOptionalNumber(row, 'stock_minimo');
          const stockMinimo = stockMinimoRow ?? producto.stock_minimo ?? 0;
          const sucursalId = this.readString(row, 'sucursal_id');

          if (disponible > stockMinimo) return null;

          return {
            producto_id: producto.id,
            sucursal_id: sucursalId,
            sucursal_nombre: sucursalId ? sucursalesMap.get(sucursalId) ?? null : null,
            sku: producto.sku ?? producto.id,
            nombre: producto.nombre ?? 'Producto',
            stock_total: disponible,
            stock_minimo: stockMinimo,
            estado: 'critico',
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      return criticos;
    } catch (error) {
      this.handleError('getProductosCriticos', error, 'Error al obtener productos criticos');
    }
  }

  async getSucursales(empresa_id: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('sucursales')
      .select(
        `
        id, nombre, tipo, direccion, activa,
        latitud, longitud,
        stock:stock_por_sucursal(cantidad, producto_id)
      `,
      )
      .eq('empresa_id', empresa_id)
      .order('nombre');

    if (error) {
      console.error('getSucursales ERROR DETALLE:', JSON.stringify(error));
      this.handleError('getSucursales', error, 'Error al obtener sucursales');
    }

    return (data || []).map((s: any) => {
      const stockItems: any[] = s.stock || [];
      const total_unidades = stockItems.reduce(
        (sum: number, item: any) => sum + (item.cantidad || 0),
        0,
      );
      const productos_activos = new Set(
        stockItems.map((item: any) => item.producto_id),
      ).size;

      return {
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo || 'tienda',
        activa: s.activa ?? true,
        direccion: s.direccion || null,
        latitud: s.latitud || null,
        longitud: s.longitud || null,
        total_unidades,
        productos_activos,
      };
    });
  }

  async crearSucursal(empresa_id: string, data: SucursalPayload): Promise<any> {
    try {
      const nombre = String(data?.nombre ?? '').trim();
      if (!nombre) {
        throw new BadRequestException('El nombre de la sucursal es obligatorio');
      }

      if (nombre.length > 120) {
        throw new BadRequestException('El nombre de la sucursal excede el maximo permitido');
      }

      const tipoEntrada = String(data?.tipo ?? 'tienda').trim().toLowerCase();
      const tipo = tipoEntrada === 'almacen' || tipoEntrada === 'almacén' ? 'almacen' : 'tienda';

      const estadoEntrada = String(data?.estado ?? 'activa').trim().toLowerCase();
      const activa = ['activo', 'activa', 'true', '1'].includes(estadoEntrada);
      const estado = activa ? 'activa' : 'inactiva';

      const payloads: Array<Record<string, unknown>> = [
        { empresa_id, nombre, tipo, estado, activa },
        { empresa_id, nombre, tipo, estado },
        { empresa_id, nombre, tipo, activa },
        { empresa_id, nombre, estado },
        { empresa_id, nombre, activa },
        { empresa_id, nombre },
      ];

      let lastError: { message?: string } | null = null;
      for (const payload of payloads) {
        const { data: insertData, error } = await this.supabase
          .getAdminClient()
          .from('sucursales')
          .insert(payload)
          .select('*');

        if (!error) {
          if (Array.isArray(insertData)) return insertData[0] ?? payload;
          return insertData ?? payload;
        }

        if (this.isRecoverableColumnError(error)) {
          lastError = error;
          continue;
        }

        throw error;
      }

      throw new InternalServerErrorException(
        `No se pudo crear sucursal: ${lastError?.message ?? 'schema incompatible'}`,
      );
    } catch (error) {
      this.handleError('crearSucursal', error, 'Error al crear sucursal');
    }
  }

  async getProductos(empresa_id: string, filters: Record<string, string> = {}) {
    try {
      const { data: productos, error } = await this.supabase
        .getAdminClient()
        .from('productos')
        .select(
          `
          id, nombre, sku, precio, costo, activo, categoria_id,
          descripcion, stock_minimo,
          stock_por_sucursal:stock_por_sucursal(
            cantidad,
            sucursal:sucursales(id, nombre)
          )
        `,
        )
        .eq('empresa_id', empresa_id)
        .order('nombre', { ascending: true });

      if (error) throw error;

      const { data: integracion } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('tipo_integracion', 'woocommerce')
        .eq('activa', true)
        .maybeSingle();

      let rows = (productos ?? []) as Array<Record<string, unknown>>;

      if (filters?.search) {
        const search = String(filters.search).trim().toLowerCase();
        if (search) {
          rows = rows.filter((p) => {
            const nombre = String(p.nombre ?? '').toLowerCase();
            const sku = String(p.sku ?? '').toLowerCase();
            return nombre.includes(search) || sku.includes(search);
          });
        }
      }

      if (filters?.limit || filters?.page) {
        const limit = this.toPositiveInt(filters?.limit, 100);
        const page = this.toPositiveInt(filters?.page, 1);
        const offset = (page - 1) * limit;
        rows = rows.slice(offset, offset + limit);
      }

      const resultado = rows.map((p) => {
        const stockPorSucursalRaw = Array.isArray(p.stock_por_sucursal)
          ? (p.stock_por_sucursal as Array<Record<string, unknown>>)
          : [];

        const stockPorSucursal = stockPorSucursalRaw.map((s) => {
          const sucursalRaw = Array.isArray(s.sucursal)
            ? ((s.sucursal[0] as Record<string, unknown>) ?? null)
            : (s.sucursal as Record<string, unknown> | null);
          return {
            sucursal_id: sucursalRaw ? this.readOptionalString(sucursalRaw, 'id') : null,
            sucursal_nombre: sucursalRaw ? this.readOptionalString(sucursalRaw, 'nombre') : null,
            cantidad: this.readNumber(s, 'cantidad'),
          };
        });

        const stockTotal = stockPorSucursal.reduce(
          (sum: number, s: { cantidad: number }) => sum + (s.cantidad || 0),
          0,
        );

        return {
          ...p,
          stock_minimo: (p as any).stock_minimo || 0,
          costo: (p as any).costo || null,
          stock_total: stockTotal,
          stock_por_sucursal: stockPorSucursal,
          woo_sincronizado: !!integracion && !!this.readOptionalString(p, 'sku'),
        };
      });

      return { productos: resultado, total: resultado.length };
    } catch (error) {
      this.handleError('getProductos', error, 'Error al obtener productos');
    }
  }

  async getCategorias(
    empresa_id: string,
    options?: { incluirInactivas?: boolean; soloActivas?: boolean },
  ) {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('categorias')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('nombre', { ascending: true });

    if (error) return { categorias: [] };

    const incluirInactivas = Boolean(options?.incluirInactivas);
    const soloActivas = Boolean(options?.soloActivas);
    const categorias = Array.isArray(data) ? data : [];

    const normalizadas = categorias.map((cat) => {
      const row = cat as Record<string, unknown>;
      const activaRaw = row.activa ?? row.activo;
      return {
        ...row,
        activa:
          typeof activaRaw === 'boolean'
            ? activaRaw
            : String(activaRaw ?? 'true').toLowerCase() !== 'false',
      };
    });

    if (incluirInactivas) {
      return { categorias: normalizadas };
    }

    if (soloActivas || !incluirInactivas) {
      return { categorias: normalizadas.filter((cat) => Boolean(cat.activa)) };
    }

    return { categorias: normalizadas };
  }

  async crearCategoria(empresa_id: string, data: any) {
    const nombre = String(data?.nombre ?? '').trim();
    if (!nombre) throw new BadRequestException('nombre requerido');

    const slug = nombre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const descripcion = String(data?.descripcion ?? '').trim() || null;
    const activa = data?.activa ?? data?.activo ?? true;

    const payloads: Array<Record<string, unknown>> = [
      {
        empresa_id,
        nombre,
        slug,
        descripcion,
        activa: Boolean(activa),
      },
      {
        empresa_id,
        nombre,
        slug,
        descripcion,
        activo: Boolean(activa),
      },
      {
        empresa_id,
        nombre,
        slug,
        descripcion,
      },
    ];

    let lastError: { message?: string } | null = null;
    for (const payload of payloads) {
      const { data: cat, error } = await this.supabase
        .getAdminClient()
        .from('categorias')
        .insert(payload)
        .select()
        .single();

      if (!error) {
        return {
          ...cat,
          activa: Boolean((cat as Record<string, unknown>)?.activa ?? (cat as Record<string, unknown>)?.activo ?? true),
        };
      }

      if (this.isRecoverableColumnError(error)) {
        lastError = error;
        continue;
      }

      throw new Error(error.message);
    }

    throw new Error(lastError?.message ?? 'No se pudo crear categoria');
  }

  async actualizarCategoria(empresa_id: string, id: string, data: any) {
    const nombre = String(data?.nombre ?? '').trim();
    if (!nombre) throw new BadRequestException('nombre requerido');

    const slug = nombre
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const descripcion = String(data?.descripcion ?? '').trim() || null;
    const activa = data?.activa ?? data?.activo ?? true;

    const payloads: Array<Record<string, unknown>> = [
      {
        nombre,
        slug,
        descripcion,
        activa: Boolean(activa),
      },
      {
        nombre,
        slug,
        descripcion,
        activo: Boolean(activa),
      },
      {
        nombre,
        slug,
        descripcion,
      },
    ];

    let lastError: { message?: string } | null = null;
    for (const payload of payloads) {
      const { data: cat, error } = await this.supabase
        .getAdminClient()
        .from('categorias')
        .update(payload)
        .eq('id', id)
        .eq('empresa_id', empresa_id)
        .select()
        .single();

      if (!error) {
        return {
          ...cat,
          activa: Boolean((cat as Record<string, unknown>)?.activa ?? (cat as Record<string, unknown>)?.activo ?? true),
        };
      }

      if (this.isRecoverableColumnError(error)) {
        lastError = error;
        continue;
      }

      throw new Error(error.message);
    }

    throw new Error(lastError?.message ?? 'No se pudo actualizar categoria');
  }

  async eliminarCategoria(empresa_id: string, id: string) {
    const { error } = await this.supabase
      .getAdminClient()
      .from('categorias')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresa_id);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  async crearProducto(empresa_id: string, data: any) {
    const { data: producto, error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .insert({
        empresa_id,
        nombre: data?.nombre,
        sku: data?.sku,
        precio: data?.precio,
        activo: typeof data?.activo === 'boolean' ? data.activo : true,
        categoria_id: data?.categoria_id || null,
        descripcion: data?.descripcion || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const stockItems = Array.isArray(data?.stock_por_sucursal)
      ? data.stock_por_sucursal.filter((s: any) => Number(s?.cantidad) > 0)
      : [];

    if (stockItems.length > 0) {
      const inserts = stockItems.map((s: any) => ({
        empresa_id,
        producto_id: producto.id,
        sucursal_id: s.sucursal_id,
        cantidad: Number(s.cantidad),
      }));

      const { error: stockError } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .insert(inserts);

      if (stockError) {
        console.error('Error insertando stock inicial:', stockError.message);
      }
    }

    return producto;
  }

  async importarProductosCSV(empresa_id: string, buffer: Buffer) {
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    if (!content.trim()) {
      throw new BadRequestException('Archivo CSV vacio');
    }

    const expectedColumns = ['nombre', 'sku', 'precio', 'costo', 'descripcion', 'stock_minimo'];
    const firstLine = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    const headers = firstLine ? firstLine.split(',').map((h) => h.trim().toLowerCase()) : [];
    const missingColumns = expectedColumns.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new BadRequestException(`Columnas faltantes en CSV: ${missingColumns.join(', ')}`);
    }

    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Array<Record<string, unknown>>;
    } catch {
      throw new BadRequestException('CSV invalido');
    }

    let exitosos = 0;
    const detalle_errores: Array<{ fila: number; sku: string | null; error: string }> = [];

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx] ?? {};
      const fila = idx + 2;
      const nombre = String(row.nombre ?? '').trim();
      const sku = String(row.sku ?? '').trim();
      const descripcion = String(row.descripcion ?? '').trim();
      const precio = Number(row.precio);
      const costo = Number(row.costo);
      const stockMinimo = Number(row.stock_minimo);

      if (!nombre || !sku || !Number.isFinite(precio)) {
        detalle_errores.push({
          fila,
          sku: sku || null,
          error: 'Fila invalida: nombre, sku y precio son obligatorios',
        });
        continue;
      }

      const payload = {
        empresa_id,
        nombre,
        sku,
        precio,
        costo: Number.isFinite(costo) ? costo : 0,
        descripcion: descripcion || null,
        stock_minimo: Number.isFinite(stockMinimo) ? stockMinimo : 0,
        activo: true,
      };

      const { error } = await this.supabase.getAdminClient().from('productos').insert(payload);
      if (error) {
        const msg = String(error.message ?? '');
        const duplicate =
          error.code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
        detalle_errores.push({
          fila,
          sku: sku || null,
          error: duplicate ? 'SKU duplicado' : msg || 'Error insertando producto',
        });
        continue;
      }

      exitosos += 1;
    }

    return {
      exitosos,
      errores: detalle_errores.length,
      detalle_errores,
      total: rows.length,
    };
  }

  async actualizarProducto(empresa_id: string, id: string, data: any) {
    const payload: Record<string, unknown> = {};
    if (data?.nombre !== undefined) payload.nombre = data.nombre;
    if (data?.sku !== undefined) payload.sku = data.sku;
    if (data?.precio !== undefined) payload.precio = data.precio;
    if (data?.costo !== undefined) payload.costo = data.costo;
    if (data?.descripcion !== undefined) payload.descripcion = data.descripcion;
    if (data?.stock_minimo !== undefined) payload.stock_minimo = data.stock_minimo;
    if (data?.activo !== undefined) payload.activo = data.activo;
    if (data?.categoria_id !== undefined) payload.categoria_id = data.categoria_id;

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    const { data: producto, error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .update(payload)
      .eq('id', id)
      .eq('empresa_id', empresa_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return producto;
  }

  async eliminarProducto(empresa_id: string, producto_id: string) {
    const { error: stockError } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .delete()
      .eq('producto_id', producto_id)
      .eq('empresa_id', empresa_id);

    if (stockError) throw new Error(stockError.message);

    const { error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .delete()
      .eq('id', producto_id)
      .eq('empresa_id', empresa_id);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  async toggleProductoActivo(empresa_id: string, producto_id: string, activo: boolean) {
    return this.actualizarProducto(empresa_id, producto_id, { activo });
  }

  async getPedidos(empresa_id: string, filters?: any): Promise<any[]> {
    try {
      const limit = this.toPositiveInt(filters?.limit, 100);
      const page = this.toPositiveInt(filters?.page, 1);
      const offset = (page - 1) * limit;

      let query = this.supabase
        .getAdminClient()
        .from('pedidos')
        .select('*, canales_venta(nombre)')
        .eq('empresa_id', empresa_id);

      if (filters?.estado) {
        query = query.eq('estado', String(filters.estado));
      }

      if (filters?.fecha_desde) {
        query = query.gte('fecha_creacion', String(filters.fecha_desde));
      }

      if (filters?.fecha_hasta) {
        query = query.lte('fecha_creacion', String(filters.fecha_hasta));
      }

      if (filters?.sucursal_id) {
        query = query.eq('sucursal_id', String(filters.sucursal_id));
      }

      let response = await query
        .order('fecha_creacion', { ascending: false })
        .range(offset, offset + limit - 1);

      if (response.error && this.isRecoverableColumnError(response.error)) {
        response = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
      }

      if (response.error) throw response.error;

      const rows = (response.data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => {
        const canalRel = row.canales_venta;
        let canal: string | null = null;

        if (Array.isArray(canalRel)) {
          const first = canalRel[0] as Record<string, unknown> | undefined;
          canal = first && typeof first.nombre === 'string' ? first.nombre : null;
        } else if (canalRel && typeof canalRel === 'object') {
          const rel = canalRel as Record<string, unknown>;
          canal = typeof rel.nombre === 'string' ? rel.nombre : null;
        }

        return { ...row, canal };
      });
    } catch (error) {
      this.handleError('getPedidos', error, 'Error al obtener pedidos');
    }
  }

  async getAlertas(
    empresa_id: string,
    filtersOrLimit?: Record<string, unknown> | number,
    soloNoLeidas = false,
  ): Promise<any[]> {
    try {
      const filters =
        typeof filtersOrLimit === 'number'
          ? { limit: filtersOrLimit, solo_no_leidas: soloNoLeidas }
          : (filtersOrLimit ?? {});
      const limit = this.toPositiveInt(filters?.limit, 100);
      const page = this.toPositiveInt(filters?.page, 1);
      const offset = (page - 1) * limit;

      let query = this.supabase
        .getAdminClient()
        .from('alertas_generadas')
        .select('*')
        .eq('empresa_id', empresa_id);

      if (filters?.nivel) {
        query = query.eq('nivel', String(filters.nivel));
      }

      if (String(filters?.solo_no_leidas ?? '').toLowerCase() === 'true') {
        query = query.eq('leida', false);
      } else if (filters?.leida !== undefined) {
        const leida = String(filters.leida).toLowerCase() === 'true';
        query = query.eq('leida', leida);
      }

      let response = await query
        .order('fecha_generada', { ascending: false })
        .range(offset, offset + limit - 1);

      if (response.error && this.isRecoverableColumnError(response.error)) {
        response = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
      }

      if (response.error) throw response.error;
      return response.data ?? [];
    } catch (error) {
      this.handleError('getAlertas', error, 'Error al obtener alertas');
    }
  }

  async getTransferencias(empresa_id: string, filtros: any = {}): Promise<{ transferencias: any[] }> {
    try {
      let query = this.supabase
        .getAdminClient()
        .from('transferencias')
        .select(
          `
          *,
          sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
          sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
          items:transferencia_items(
            id, cantidad_enviada, cantidad_recibida, observacion_item,
            producto:productos(id, nombre, sku)
          )
        `,
        )
        .eq('empresa_id', empresa_id);

      if (filtros?.estado) {
        query = query.eq('estado', String(filtros.estado));
      }

      if (filtros?.sucursalId) {
        const sucursalId = String(filtros.sucursalId);
        if (!/^[A-Za-z0-9-]{1,80}$/.test(sucursalId)) {
          throw new BadRequestException('sucursal_id invalido');
        }
        query = query.or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`);
      }

      const { data, error } = await query.order('fecha_creacion', { ascending: false });
      if (error) throw new Error(error.message);
      return { transferencias: data || [] };
    } catch (error) {
      this.handleError('getTransferencias', error, 'Error al obtener transferencias');
    }
  }

  async getStock(empresa_id: string, sucursal_id?: string) {
    try {
      if (sucursal_id) {
        const { data: sucursal, error: sucursalError } = await this.supabase
          .getAdminClient()
          .from('sucursales')
          .select('id')
          .eq('id', sucursal_id)
          .eq('empresa_id', empresa_id)
          .maybeSingle();

        if (sucursalError || !sucursal) {
          // [SECURITY FIX] Bloquea acceso a stock de sucursales fuera del tenant.
          throw new BadRequestException('Sucursal no valida para la empresa autenticada');
        }
      }

      let query = this.supabase
        .getAdminClient()
            .from('stock_por_sucursal')
        .select(
          `
          id, cantidad, cantidad_reservada, ultima_actualizacion,
          sucursal_id,
          producto:productos(id, nombre, sku, stock_minimo)
        `,
        )
        .eq('empresa_id', empresa_id);

      if (sucursal_id) {
        query = query.eq('sucursal_id', sucursal_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((item: any) => {
        const productoRaw = Array.isArray(item?.producto) ? item.producto[0] : item?.producto;
        return {
          id: item.id,
          producto_id: productoRaw?.id,
          producto_nombre: productoRaw?.nombre,
          producto_sku: productoRaw?.sku,
          stock_minimo: productoRaw?.stock_minimo || 0,
          sucursal_id: item.sucursal_id,
          cantidad: item.cantidad || 0,
          cantidad_reservada: item.cantidad_reservada || 0,
          ultima_actualizacion: item.ultima_actualizacion,
        };
      });
    } catch (error) {
      this.handleError('getStock', error, 'Error al obtener stock por sucursal');
    }
  }

  async getStockPorSucursal(empresa_id: string, sucursal_id?: string): Promise<any[]> {
    return this.getStock(empresa_id, sucursal_id);
  }

  async ajustarStock(
    empresa_id: string,
    usuario_id: string,
    data: {
      producto_id: string;
      sucursal_id: string;
      tipo: 'entrada' | 'salida';
      cantidad: number;
      motivo: string;
    },
  ) {
    void usuario_id;
    try {
      if (!data?.producto_id || !data?.sucursal_id) {
        throw new BadRequestException('producto_id y sucursal_id son obligatorios');
      }
      if (!['entrada', 'salida'].includes(String(data?.tipo))) {
        throw new BadRequestException('Tipo de ajuste invalido');
      }
      if (!Number.isFinite(Number(data?.cantidad)) || Number(data.cantidad) <= 0) {
        throw new BadRequestException('La cantidad debe ser mayor a 0');
      }

      const { data: sucursalValida, error: sucursalError } = await this.supabase
        .getAdminClient()
        .from('sucursales')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('id', data.sucursal_id)
        .maybeSingle();
      if (sucursalError || !sucursalValida) {
        throw new BadRequestException('Sucursal no valida para la empresa autenticada');
      }

      const { data: productoValido, error: productoError } = await this.supabase
        .getAdminClient()
        .from('productos')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('id', data.producto_id)
        .maybeSingle();
      if (productoError || !productoValido) {
        throw new BadRequestException('Producto no valido para la empresa autenticada');
      }

      const { data: stockActual, error: fetchError } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .select('id, cantidad')
        .eq('empresa_id', empresa_id)
        .eq('producto_id', data.producto_id)
        .eq('sucursal_id', data.sucursal_id)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);

      const cantidadActual = stockActual?.cantidad || 0;
      const nuevaCantidad = data.tipo === 'entrada'
        ? cantidadActual + data.cantidad
        : cantidadActual - data.cantidad;

      if (nuevaCantidad < 0) {
        throw new BadRequestException(
          `Stock insuficiente. Actual: ${cantidadActual}, solicitado: ${data.cantidad}`,
        );
      }

      if (stockActual) {
        const { error } = await this.supabase
          .getAdminClient()
          .from('stock_por_sucursal')
          .update({
            cantidad: nuevaCantidad,
            ultima_actualizacion: new Date().toISOString(),
          })
          .eq('id', stockActual.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.supabase
          .getAdminClient()
          .from('stock_por_sucursal')
          .insert({
            empresa_id,
            producto_id: data.producto_id,
            sucursal_id: data.sucursal_id,
            cantidad: data.cantidad,
            ultima_actualizacion: new Date().toISOString(),
          });

        if (error) throw new Error(error.message);
      }

      const result = {
        success: true,
        cantidad_anterior: cantidadActual,
        cantidad_nueva: nuevaCantidad,
        tipo: data.tipo,
        motivo: data.motivo,
      };

      this.alertasService.verificarStockBajo(empresa_id).catch(() => {});

      return result;
    } catch (error) {
      this.handleError('ajustarStock', error, 'Error al ajustar stock');
    }
  }

  async verificarStockBajoEmpresa(empresa_id: string) {
    return this.alertasService.verificarStockBajo(empresa_id);
  }

  async getIntegraciones(empresa_id: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;

      const integraciones = (data ?? []) as Array<Record<string, unknown>>;
      const canalIds = this.uniqueIds(integraciones, 'canal_id');

      const canalesMap = new Map<string, string>();
      if (canalIds.length > 0) {
        const { data: canales, error: canalesError } = await this.supabase
          .getAdminClient()
          .from('canales_venta')
          .select('id, nombre')
          .eq('empresa_id', empresa_id)
          .in('id', canalIds);

        if (canalesError) throw canalesError;

        for (const canal of canales ?? []) {
          const id = this.readString(canal as Record<string, unknown>, 'id');
          const nombre = this.readString(canal as Record<string, unknown>, 'nombre');
          if (id && nombre) canalesMap.set(id, nombre);
        }
      }

      return integraciones.map((row) => {
        const canalId = this.readString(row, 'canal_id');
        return {
          ...row,
          canal: canalId ? canalesMap.get(canalId) ?? null : null,
        };
      });
    } catch (error) {
      this.handleError('getIntegraciones', error, 'Error al obtener integraciones');
    }
  }

  async conectarIntegracion(
    empresa_id: string,
    data: {
      tipo: string;
      credenciales: Record<string, string>;
      modo: 'conectar' | 'configurar';
    },
  ) {
    try {
      if (!data?.tipo) {
        throw new BadRequestException('tipo de integracion requerido');
      }

      const nombreCanal =
        {
          woocommerce: 'WooCommerce',
          mercadolibre: 'Mercado Libre',
          shopify: 'Shopify',
          whatsapp: 'WhatsApp',
        }[data.tipo] || data.tipo;

      let canalId: string | null = null;
      {
        const { data: canal, error: canalError } = await this.supabase
          .getAdminClient()
          .from('canales_venta')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('nombre', nombreCanal)
          .maybeSingle();

        if (canalError && canalError.code !== 'PGRST116') {
          throw canalError;
        }

        canalId = this.readString(canal as Record<string, unknown>, 'id');

        if (!canalId) {
          const { data: newCanal, error: newCanalError } = await this.supabase
            .getAdminClient()
            .from('canales_venta')
            .insert({ empresa_id, nombre: nombreCanal })
            .select('id')
            .single();

          if (newCanalError) throw newCanalError;
          canalId = this.readString(newCanal as Record<string, unknown>, 'id');
        }
      }

      if (!canalId) throw new Error('No se pudo obtener canal_id');

      const backendUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
      const webhookUrl = `${backendUrl}/api/integraciones/${data.tipo}/webhook/${empresa_id}`;

      const payload = {
        empresa_id,
        canal_id: canalId,
        tipo_integracion: data.tipo,
        credenciales: data.credenciales || {},
        webhook_url: webhookUrl,
        activa: true,
        intervalo_sync_minutos: 15,
      };

      const { error: upsertError } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .upsert(payload, { onConflict: 'empresa_id,tipo_integracion' });

      if (upsertError) {
        const { data: existing, error: existingError } = await this.supabase
          .getAdminClient()
          .from('integraciones_canal')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('tipo_integracion', data.tipo)
          .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
          throw existingError;
        }

        const existingId = this.readString(existing as Record<string, unknown>, 'id');

        if (existingId) {
          const { error: updateError } = await this.supabase
            .getAdminClient()
            .from('integraciones_canal')
            .update({
              credenciales: data.credenciales || {},
              webhook_url: webhookUrl,
              activa: true,
              intervalo_sync_minutos: 15,
            })
            .eq('id', existingId);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await this.supabase
            .getAdminClient()
            .from('integraciones_canal')
            .insert(payload);

          if (insertError) throw insertError;
        }
      }

      return { success: true, webhook_url: webhookUrl };
    } catch (error) {
      this.handleError('conectarIntegracion', error, 'Error al conectar integracion');
    }
  }

  async desconectarIntegracion(empresa_id: string, tipo: string) {
    try {
      if (!tipo) throw new BadRequestException('tipo de integracion requerido');

      const { error } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .update({ activa: false })
        .eq('empresa_id', empresa_id)
        .eq('tipo_integracion', tipo);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      this.handleError('desconectarIntegracion', error, 'Error al desconectar integracion');
    }
  }

  async getUsuarios(empresa_id: string): Promise<any[]> {
    try {
      const { data: perfiles, error } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .select('id, rol, sucursal_id, fecha_creacion')
        .eq('empresa_id', empresa_id);

      if (error) throw error;

      const usuarios = await Promise.all(
        (perfiles || []).map(async (perfil) => {
          try {
            const { data: authData, error: authError } = await this.supabase
              .getAdminClient()
              .auth.admin.getUserById(perfil.id);

            if (authError) throw authError;

            const bannedUntil = authData?.user?.banned_until;
            const activo = !bannedUntil || String(bannedUntil).toLowerCase() === 'none';

            return {
              id: perfil.id,
              email: authData?.user?.email || '—',
              rol: perfil.rol,
              sucursal_id: perfil.sucursal_id,
              activo,
              fecha_creacion: perfil.fecha_creacion,
            };
          } catch {
            return {
              id: perfil.id,
              email: '—',
              rol: perfil.rol,
              sucursal_id: perfil.sucursal_id,
              activo: true,
              fecha_creacion: perfil.fecha_creacion,
            };
          }
        }),
      );

      return usuarios;
    } catch (error) {
      this.handleError('getUsuarios', error, 'Error al obtener usuarios');
    }
  }

  async crearUsuario(
    empresa_id: string,
    data: {
      email: string;
      password: string;
      rol: string;
      sucursal_id: string | null;
    },
  ) {
    try {
      const rol = String(data?.rol || '').trim();
      if (!['admin_empresa', 'encargado_sucursal', 'vendedor'].includes(rol)) {
        throw new BadRequestException('Rol invalido');
      }
      if (!data?.email || !String(data.email).includes('@')) {
        throw new BadRequestException('Email invalido');
      }
      if (!data?.password || String(data.password).length < 8) {
        throw new BadRequestException('Password debe tener minimo 8 caracteres');
      }
      if (rol !== 'admin_empresa' && !data?.sucursal_id) {
        throw new BadRequestException('Debe asignar una sucursal para este rol');
      }

      if (data?.sucursal_id) {
        const { data: sucursal, error: sucError } = await this.supabase
          .getAdminClient()
          .from('sucursales')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('id', data.sucursal_id)
          .maybeSingle();

        if (sucError || !sucursal) {
          throw new BadRequestException('Sucursal invalida para la empresa autenticada');
        }
      }

      const { data: authData, error: authError } = await this.supabase
        .getAdminClient()
        .auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
        });

      if (authError) throw new BadRequestException(authError.message);

      const userId = authData?.user?.id;
      if (!userId) throw new Error('No se pudo crear el usuario en Auth');

      const { error: perfilError } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .insert({
          id: userId,
          empresa_id,
          rol,
          sucursal_id: rol === 'admin_empresa' ? null : data.sucursal_id || null,
        });

      if (perfilError) {
        await this.supabase.getAdminClient().auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(perfilError.message);
      }

      return { success: true, id: userId };
    } catch (error) {
      this.handleError('crearUsuario', error, 'Error al crear usuario');
    }
  }

  async editarUsuario(
    empresa_id: string,
    id: string,
    data: { rol: string; sucursal_id: string | null },
  ) {
    try {
      const rol = String(data?.rol || '').trim();
      if (!['admin_empresa', 'encargado_sucursal', 'vendedor'].includes(rol)) {
        throw new BadRequestException('Rol invalido');
      }
      if (rol !== 'admin_empresa' && !data?.sucursal_id) {
        throw new BadRequestException('Debe asignar una sucursal para este rol');
      }

      const { data: perfil, error } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .select('id')
        .eq('id', id)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (error || !perfil) throw new BadRequestException('Usuario no encontrado');

      if (data?.sucursal_id) {
        const { data: sucursal, error: sucError } = await this.supabase
          .getAdminClient()
          .from('sucursales')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('id', data.sucursal_id)
          .maybeSingle();

        if (sucError || !sucursal) {
          throw new BadRequestException('Sucursal invalida para la empresa autenticada');
        }
      }

      const { error: updateError } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .update({
          rol,
          sucursal_id: rol === 'admin_empresa' ? null : data.sucursal_id || null,
        })
        .eq('id', id);

      if (updateError) throw new Error(updateError.message);
      return { success: true };
    } catch (error) {
      this.handleError('editarUsuario', error, 'Error al editar usuario');
    }
  }

  async toggleUsuario(empresa_id: string, id: string, activo: boolean) {
    try {
      const { data: perfil, error } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .select('id')
        .eq('id', id)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (error || !perfil) throw new BadRequestException('Usuario no encontrado');

      const { error: authError } = await this.supabase
        .getAdminClient()
        .auth.admin.updateUserById(id, {
          ban_duration: activo ? 'none' : '876600h',
        });

      if (authError) throw new Error(authError.message);
      return { success: true, activo };
    } catch (error) {
      this.handleError('toggleUsuario', error, 'Error al actualizar usuario');
    }
  }

  async resetPasswordUsuario(empresa_id: string, email: string) {
    try {
      if (!email || !String(email).includes('@')) {
        throw new BadRequestException('Email invalido');
      }

      const { data: authUsers, error: listError } = await this.supabase
        .getAdminClient()
        .auth.admin.listUsers();

      if (listError) throw new Error(listError.message);

      const user = authUsers?.users?.find((u) => String(u?.email || '').toLowerCase() === email.toLowerCase());
      if (!user) throw new BadRequestException('Usuario no encontrado');

      const { data: perfil, error: perfilError } = await this.supabase
        .getAdminClient()
        .from('perfiles')
        .select('id')
        .eq('id', user.id)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (perfilError || !perfil) {
        throw new BadRequestException('Usuario no pertenece a esta empresa');
      }

      const { error } = await this.supabase
        .getAdminClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
        });

      if (error) throw new Error(error.message);
      return { success: true };
    } catch (error) {
      this.handleError('resetPasswordUsuario', error, 'Error al enviar reset');
    }
  }

  async crearTransferencia(
    empresa_id: string,
    usuario_id: string,
    data: TransferenciaPayload,
  ): Promise<any> {
    try {
      if (!data?.sucursal_origen_id || !data?.sucursal_destino_id) {
        throw new BadRequestException('Faltan datos obligatorios de transferencia');
      }

      if (data.sucursal_origen_id === data.sucursal_destino_id) {
        throw new BadRequestException('La sucursal origen y destino no pueden ser la misma');
      }

      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new BadRequestException('La transferencia debe incluir al menos un item');
      }

      const ids = new Set<string>();
      for (const item of data.items) {
        const cantidad = Number(item?.cantidad_enviada);
        if (!item?.producto_id || !Number.isFinite(cantidad) || cantidad <= 0) {
          throw new BadRequestException('Cada item debe incluir producto_id y cantidad_enviada > 0');
        }
        if (ids.has(item.producto_id)) {
          throw new BadRequestException('No se permite repetir el mismo producto en la transferencia');
        }
        ids.add(item.producto_id);
      }

      const { data: sucursalesValidas, error: sucursalesError } = await this.supabase
        .getAdminClient()
        .from('sucursales')
        .select('id')
        .eq('empresa_id', empresa_id)
        .in('id', [data.sucursal_origen_id, data.sucursal_destino_id]);

      if (sucursalesError || (sucursalesValidas ?? []).length !== 2) {
        throw new BadRequestException('Sucursales invalidas para la empresa autenticada');
      }

      const productoIds = [...new Set(data.items.map((item) => item.producto_id))];
      const { data: productosValidos, error: productosError } = await this.supabase
        .getAdminClient()
        .from('productos')
        .select('id')
        .eq('empresa_id', empresa_id)
        .in('id', productoIds);

      if (productosError || (productosValidos ?? []).length !== productoIds.length) {
        throw new BadRequestException('Existen productos invalidos para la empresa autenticada');
      }

      for (const item of data.items) {
        const { data: stock, error: stockError } = await this.supabase
          .getAdminClient()
          .from('stock_por_sucursal')
          .select('cantidad')
          .eq('empresa_id', empresa_id)
          .eq('sucursal_id', data.sucursal_origen_id)
          .eq('producto_id', item.producto_id)
          .maybeSingle();

        if (stockError && stockError.code !== 'PGRST116') {
          throw stockError;
        }

        const disponible = Number(stock?.cantidad || 0);
        if (Number(item.cantidad_enviada) > disponible) {
          const { data: prod } = await this.supabase
            .getAdminClient()
            .from('productos')
            .select('nombre, sku')
            .eq('id', item.producto_id)
            .maybeSingle();

          throw new BadRequestException(
            `Stock insuficiente para ${prod?.nombre || item.producto_id}. Disponible: ${disponible}, solicitado: ${item.cantidad_enviada}`,
          );
        }
      }

      const { data: transferencia, error: transferenciaError } = await this.supabase
        .getAdminClient()
        .from('transferencias')
        .insert({
          empresa_id,
          sucursal_origen_id: data.sucursal_origen_id,
          sucursal_destino_id: data.sucursal_destino_id,
          estado: 'pendiente',
          notas: data.notas || null,
          aprobacion_requerida: data.aprobacion_requerida ?? true,
          creado_por: usuario_id,
        })
        .select('*')
        .single();

      if (transferenciaError || !transferencia) {
        throw transferenciaError ?? new Error('No se pudo crear la transferencia');
      }

      const transferenciaId = this.readString(transferencia as Record<string, unknown>, 'id');
      if (!transferenciaId) {
        throw new InternalServerErrorException('No se pudo resolver el id de transferencia');
      }

      const itemsPayload = data.items.map((item) => ({
        transferencia_id: transferenciaId,
        producto_id: item.producto_id,
        cantidad_enviada: Number(item.cantidad_enviada),
        cantidad_recibida: 0,
      }));

      const { data: itemsInsertados, error: itemsError } = await this.supabase
        .getAdminClient()
        .from('transferencia_items')
        .insert(itemsPayload)
        .select('*');

      if (itemsError) {
        await this.supabase
          .getAdminClient()
          .from('transferencias')
          .delete()
          .eq('id', transferenciaId)
          .eq('empresa_id', empresa_id);

        throw itemsError;
      }

      console.log(
        'TRANSFERENCIA aprobacion_requerida:',
        transferencia.aprobacion_requerida,
        'data.aprobacion_requerida:',
        data.aprobacion_requerida,
      );

      if (Boolean(transferencia.aprobacion_requerida ?? true)) {
        const ruta = await this.getTransferenciaRutaTexto(
          empresa_id,
          data.sucursal_origen_id,
          data.sucursal_destino_id,
        );
        const mensaje = `Transferencia pendiente: ${ruta} (${data.items.length} producto(s))`;
        this.alertasService.generarAlerta(empresa_id, mensaje, 'advertencia').catch(() => {});
      }

      if (!Boolean(transferencia.aprobacion_requerida ?? true)) {
        await this.supabase
          .getAdminClient()
          .from('transferencias')
          .update({
            estado: 'aprobada',
            aprobado_por: usuario_id,
            fecha_aprobacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', transferenciaId)
          .eq('empresa_id', empresa_id);

        await this.ejecutarTransferencia(empresa_id, transferenciaId, usuario_id);
        this.alertasService.verificarStockBajo(empresa_id).catch(() => {});
      }

      return {
        ...transferencia,
        items: itemsInsertados ?? [],
      };
    } catch (error) {
      this.handleError('crearTransferencia', error, 'Error al crear transferencia');
    }
  }

  async aprobarTransferencia(empresa_id: string, usuario_id: string, id: string) {
    try {
      const { data: transferencia, error } = await this.supabase
        .getAdminClient()
        .from('transferencias')
        .select('*, items:transferencia_items(*)')
        .eq('id', id)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (error) throw error;
      if (!transferencia) throw new BadRequestException('Transferencia no encontrada');
      if (transferencia.estado !== 'pendiente') {
        throw new BadRequestException(
          `No se puede aprobar una transferencia en estado ${transferencia.estado}`,
        );
      }

      const { error: updateError } = await this.supabase
        .getAdminClient()
        .from('transferencias')
        .update({
          estado: 'aprobada',
          aprobado_por: usuario_id,
          fecha_aprobacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresa_id);

      if (updateError) throw updateError;

      const resultado = await this.ejecutarTransferencia(empresa_id, id, usuario_id);
      const ruta = await this.getTransferenciaRutaTexto(
        empresa_id,
        this.readString(transferencia as Record<string, unknown>, 'sucursal_origen_id'),
        this.readString(transferencia as Record<string, unknown>, 'sucursal_destino_id'),
      );
      this.alertasService
        .generarAlerta(empresa_id, `Transferencia aprobada: ${ruta}`, 'informativa')
        .catch(() => {});
      this.alertasService.verificarStockBajo(empresa_id).catch(() => {});

      if (resultado.parcial) {
        return {
          success: true,
          parcial: true,
          message: `Transferencia aprobada con ${resultado.errores.length} item(s) pendientes de procesar`,
        };
      }

      return { success: true, message: 'Transferencia aprobada y ejecutada' };
    } catch (error) {
      this.handleError('aprobarTransferencia', error, 'Error al aprobar transferencia');
    }
  }

  async rechazarTransferencia(empresa_id: string, id: string, motivo: string) {
    try {
      const { data: transferencia, error } = await this.supabase
        .getAdminClient()
        .from('transferencias')
        .select('estado, sucursal_origen_id, sucursal_destino_id')
        .eq('id', id)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (error) throw error;
      if (!transferencia) throw new BadRequestException('Transferencia no encontrada');
      if (transferencia.estado !== 'pendiente') {
        throw new BadRequestException(
          `No se puede rechazar una transferencia en estado ${transferencia.estado}`,
        );
      }

      const { error: rejectError } = await this.supabase
        .getAdminClient()
        .from('transferencias')
        .update({
          estado: 'rechazada',
          notas: motivo || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresa_id);

      if (rejectError) throw rejectError;
      const ruta = await this.getTransferenciaRutaTexto(
        empresa_id,
        this.readString(transferencia as Record<string, unknown>, 'sucursal_origen_id'),
        this.readString(transferencia as Record<string, unknown>, 'sucursal_destino_id'),
      );
      this.alertasService
        .generarAlerta(empresa_id, `Transferencia rechazada: ${ruta}`, 'informativa')
        .catch(() => {});
      return { success: true, message: 'Transferencia rechazada' };
    } catch (error) {
      this.handleError('rechazarTransferencia', error, 'Error al rechazar transferencia');
    }
  }

  private async ejecutarTransferencia(
    empresa_id: string,
    transferencia_id: string,
    usuario_id: string,
  ): Promise<{ parcial: boolean; errores: string[]; total: number }> {
    void usuario_id;
    const nowIso = new Date().toISOString();

    const { data: transferencia, error } = await this.supabase
      .getAdminClient()
      .from('transferencias')
      .select('id, empresa_id, sucursal_origen_id, sucursal_destino_id, items:transferencia_items(*)')
      .eq('id', transferencia_id)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (error) throw error;
    if (!transferencia) throw new BadRequestException('Transferencia no encontrada');

    const items = Array.isArray(transferencia.items) ? transferencia.items : [];
    if (items.length === 0) {
      await this.supabase
        .getAdminClient()
        .from('transferencias')
        .update({ estado: 'completada', fecha_actualizacion: nowIso })
        .eq('id', transferencia_id)
        .eq('empresa_id', empresa_id);
      await this.forzarSyncWooCommerce(empresa_id);
      return { parcial: false, errores: [], total: 0 };
    }

    await this.supabase
      .getAdminClient()
      .from('transferencias')
      .update({ estado: 'en_transito', fecha_actualizacion: nowIso })
      .eq('id', transferencia_id)
      .eq('empresa_id', empresa_id);

    const settled = await Promise.allSettled(
      items.map((item: any) => this.moverStockTransferenciaItem(empresa_id, transferencia, item)),
    );

    const errores = settled
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason?.message || r.reason || 'Error desconocido'));

    if (errores.length === 0) {
      await this.supabase
        .getAdminClient()
        .from('transferencias')
        .update({ estado: 'completada', fecha_actualizacion: new Date().toISOString() })
        .eq('id', transferencia_id)
        .eq('empresa_id', empresa_id);
    } else {
      await this.supabase
        .getAdminClient()
        .from('transferencias')
        .update({ estado: 'en_transito', fecha_actualizacion: new Date().toISOString() })
        .eq('id', transferencia_id)
        .eq('empresa_id', empresa_id);
    }

    await this.forzarSyncWooCommerce(empresa_id);
    return { parcial: errores.length > 0, errores, total: items.length };
  }

  private async moverStockTransferenciaItem(
    empresa_id: string,
    transferencia: any,
    item: any,
  ): Promise<void> {
    const productoId = String(item?.producto_id || '');
    const cantidad = Number(item?.cantidad_enviada || 0);
    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException('Item de transferencia invalido');
    }

    const rpcResult = await this.supabase.getAdminClient().rpc('decrementar_stock', {
      p_empresa_id: empresa_id,
      p_sucursal_id: transferencia.sucursal_origen_id,
      p_producto_id: productoId,
      p_cantidad: cantidad,
    });

    if (rpcResult.error) {
      const code = String(rpcResult.error.code ?? '');
      const message = String(rpcResult.error.message ?? '').toLowerCase();
      const funcionNoExiste =
        code === '42883'
        || code === 'PGRST202'
        || message.includes('decrementar_stock')
        || message.includes('function');

      if (!funcionNoExiste) {
        throw new Error(rpcResult.error.message || 'No se pudo descontar stock de origen');
      }

      await this.decrementarStockManual(
        empresa_id,
        transferencia.sucursal_origen_id,
        productoId,
        cantidad,
      );
    }

    const { data: stockDestino, error: stockDestinoError } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('id, cantidad')
      .eq('empresa_id', empresa_id)
      .eq('sucursal_id', transferencia.sucursal_destino_id)
      .eq('producto_id', productoId)
      .maybeSingle();

    if (stockDestinoError && stockDestinoError.code !== 'PGRST116') {
      throw stockDestinoError;
    }

    if (stockDestino?.id) {
      const { error: updateDestinoError } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .update({ cantidad: Number(stockDestino.cantidad || 0) + cantidad })
        .eq('id', stockDestino.id);
      if (updateDestinoError) throw updateDestinoError;
    } else {
      const { error: insertDestinoError } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .insert({
          empresa_id,
          sucursal_id: transferencia.sucursal_destino_id,
          producto_id: productoId,
          cantidad,
        });
      if (insertDestinoError) throw insertDestinoError;
    }

    const { error: itemError } = await this.supabase
      .getAdminClient()
      .from('transferencia_items')
      .update({ cantidad_recibida: cantidad })
      .eq('id', item.id);

    if (itemError) throw itemError;
  }

  private async decrementarStockManual(
    empresa_id: string,
    sucursal_id: string,
    producto_id: string,
    cantidad: number,
  ): Promise<void> {
    const { data: stockOrigen, error: stockOrigenError } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('id, cantidad')
      .eq('empresa_id', empresa_id)
      .eq('sucursal_id', sucursal_id)
      .eq('producto_id', producto_id)
      .maybeSingle();

    if (stockOrigenError && stockOrigenError.code !== 'PGRST116') {
      throw stockOrigenError;
    }

    const disponible = Number(stockOrigen?.cantidad || 0);
    if (!stockOrigen?.id || disponible < cantidad) {
      throw new BadRequestException(
        `Stock insuficiente en sucursal origen para producto ${producto_id}. Disponible: ${disponible}, solicitado: ${cantidad}`,
      );
    }

    const { error: updateError } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .update({ cantidad: Math.max(0, disponible - cantidad) })
      .eq('id', stockOrigen.id);

    if (updateError) throw updateError;
  }

  private async forzarSyncWooCommerce(empresa_id: string): Promise<void> {
    try {
      const { data: integracion, error: integracionError } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('tipo_integracion', 'woocommerce')
        .eq('activa', true)
        .maybeSingle();

      if (integracionError || !integracion) return;

      const { error } = await this.supabase.getAdminClient().rpc('enqueue_woocommerce_sync', {
        p_empresa_id: empresa_id,
        p_tipo: 'sync-stock',
      });

      if (error) {
        this.logger.warn(`[forzarSyncWooCommerce] No se pudo forzar sync WooCommerce: ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`[forzarSyncWooCommerce] ${message}`);
    }
  }

  private async countRows(
    table: string,
    empresa_id: string,
    extraFilters?: Record<string, string | boolean | number>,
  ): Promise<number> {
    let query = this.supabase
      .getAdminClient()
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id);

    if (extraFilters) {
      for (const [key, value] of Object.entries(extraFilters)) {
        query = query.eq(key, value);
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  private async countRowsWithDateFallback(
    table: string,
    empresa_id: string,
    fromIso: string,
    dateFields: string[],
  ): Promise<number> {
    let lastError: unknown = null;

    for (const field of dateFields) {
      const { count, error } = await this.supabase
        .getAdminClient()
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa_id)
        .gte(field, fromIso);

      if (!error) {
        return count ?? 0;
      }

      if (!this.isRecoverableColumnError(error)) {
        throw error;
      }
      lastError = error;
    }

    if (lastError) {
      throw lastError;
    }
    return 0;
  }

  private async getStockRowsWithFallback(
    empresa_id: string,
  ): Promise<Array<Record<string, unknown>>> {
    const withMinimo = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('id, empresa_id, sucursal_id, producto_id, cantidad, cantidad_reservada, stock_minimo')
      .eq('empresa_id', empresa_id);

    if (!withMinimo.error) {
      return (withMinimo.data ?? []) as Array<Record<string, unknown>>;
    }

    if (!this.isRecoverableColumnError(withMinimo.error)) {
      throw withMinimo.error;
    }

    const fallback = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('id, empresa_id, sucursal_id, producto_id, cantidad, cantidad_reservada')
      .eq('empresa_id', empresa_id);

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as Array<Record<string, unknown>>;
  }

  private async getProductosMap(
    empresa_id: string,
    productoIds: string[],
  ): Promise<Map<string, { id: string; nombre: string | null; sku: string | null; stock_minimo: number }>> {
    const map = new Map<string, { id: string; nombre: string | null; sku: string | null; stock_minimo: number }>();
    if (productoIds.length === 0) return map;

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, nombre, sku, stock_minimo')
      .eq('empresa_id', empresa_id)
      .in('id', productoIds);

    if (error) throw error;

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = this.readString(record, 'id');
      if (!id) continue;

      map.set(id, {
        id,
        nombre: this.readOptionalString(record, 'nombre'),
        sku: this.readOptionalString(record, 'sku'),
        stock_minimo: this.readNumber(record, 'stock_minimo'),
      });
    }

    return map;
  }

  private async getSucursalesMap(
    empresa_id: string,
    sucursalIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (sucursalIds.length === 0) return map;

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('sucursales')
      .select('id, nombre')
      .eq('empresa_id', empresa_id)
      .in('id', sucursalIds);

    if (error) throw error;

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = this.readString(record, 'id');
      const nombre = this.readString(record, 'nombre');
      if (id && nombre) {
        map.set(id, nombre);
      }
    }

    return map;
  }

  private async getTransferenciaRutaTexto(
    empresa_id: string,
    sucursalOrigenId: string | null,
    sucursalDestinoId: string | null,
  ): Promise<string> {
    const ids = [sucursalOrigenId, sucursalDestinoId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    const sucursalesMap = await this.getSucursalesMap(empresa_id, ids);
    const origen = sucursalOrigenId ? sucursalesMap.get(sucursalOrigenId) ?? sucursalOrigenId : 'Origen';
    const destino = sucursalDestinoId
      ? sucursalesMap.get(sucursalDestinoId) ?? sucursalDestinoId
      : 'Destino';
    return `${origen} -> ${destino}`;
  }

  private uniqueIds(rows: Array<Record<string, unknown>>, key: string): string[] {
    return [...new Set(rows.map((row) => this.readString(row, key)).filter((id): id is string => Boolean(id)))];
  }

  private readString(row: Record<string, unknown>, key: string): string | null {
    const value = row[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private readOptionalString(row: Record<string, unknown>, key: string): string | null {
    const value = row[key];
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : String(value);
  }

  private readNumber(row: Record<string, unknown>, key: string): number {
    const value = Number(row[key]);
    return Number.isFinite(value) ? value : 0;
  }

  private readOptionalNumber(row: Record<string, unknown>, key: string): number | null {
    const value = row[key];
    if (value === undefined || value === null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRecoverableColumnError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = String(err?.code ?? '');
    const message = String(err?.message ?? '').toLowerCase();

    return (
      code === '42703' ||
      code === 'PGRST204' ||
      message.includes('column') ||
      message.includes('schema cache') ||
      message.includes('does not exist')
    );
  }

  private handleError(context: string, error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const message = error instanceof Error ? error.message : fallbackMessage;
    this.logger.error(`[${context}] ${message}`);
    throw new InternalServerErrorException(fallbackMessage);
  }
}
