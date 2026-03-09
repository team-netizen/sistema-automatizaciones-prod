import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

type EmpresaEstado = 'activo' | 'suspendido';
type PlanPayload = {
  nombre?: string;
  precio?: number;
  maximo_usuarios?: number;
  limite_tokens_mensual?: number;
  limite_ejecuciones_mensual?: number;
};

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getAdminClient();
  }

  private sanitizeSearch(value?: string) {
    return String(value || '').trim().replace(/[,%()]/g, '');
  }

  private normalizeMes(value?: string) {
    const raw = String(value || '').trim();
    if (!raw) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!/^\d{4}-\d{2}$/.test(raw)) {
      throw new BadRequestException('mes debe tener formato YYYY-MM');
    }

    return raw;
  }

  private getMonthRange(mes: string) {
    const [yearRaw, monthRaw] = mes.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!year || month < 1 || month > 12) {
      throw new BadRequestException('mes invalido');
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  private unique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
  }

  private pickCurrentSubscription(rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const ordered = [...rows].sort((a, b) =>
      String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')),
    );

    return ordered.find((row) => row.estado === 'activa') ?? ordered[0] ?? null;
  }

  private async getAuthUsersMap() {
    const emailMap: Record<string, string> = {};
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await this.supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        this.logger.warn(`[getAuthUsersMap] ${error.message}`);
        break;
      }

      const users = Array.isArray((data as any)?.users) ? (data as any).users : [];
      users.forEach((user: any) => {
        if (user?.id) {
          emailMap[user.id] = user.email || 'Sin email';
        }
      });

      const lastPage = Number((data as any)?.lastPage || (data as any)?.last_page || page);
      if (users.length < perPage || page >= lastPage) {
        break;
      }

      page += 1;
    }

    return emailMap;
  }

  private async getEmpresaMap(empresaIds: string[]) {
    const ids = this.unique(empresaIds);
    if (!ids.length) return {};

    const { data, error } = await this.supabase
      .from('empresas')
      .select('id, nombre')
      .in('id', ids);

    if (error) {
      this.logger.warn(`[getEmpresaMap] ${error.message}`);
      return {};
    }

    return Object.fromEntries((data ?? []).map((row: any) => [row.id, row.nombre || 'Empresa']));
  }

  private async getSucursalMap(sucursalIds: string[]) {
    const ids = this.unique(sucursalIds);
    if (!ids.length) return {};

    const { data, error } = await this.supabase
      .from('sucursales')
      .select('id, nombre')
      .in('id', ids);

    if (error) {
      this.logger.warn(`[getSucursalMap] ${error.message}`);
      return {};
    }

    return Object.fromEntries((data ?? []).map((row: any) => [row.id, row.nombre || 'Sucursal']));
  }

  async getDashboardResumen() {
    const [
      totalEmpresasRes,
      empresasActivasRes,
      suscripcionesActivasRes,
      totalUsuariosRes,
      ultimasEmpresasRes,
    ] = await Promise.all([
      this.supabase.from('empresas').select('*', { count: 'exact', head: true }),
      this.supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      this.supabase.from('suscripciones_empresa').select('*', { count: 'exact', head: true }).eq('estado', 'activa'),
      this.supabase.from('perfiles').select('*', { count: 'exact', head: true }).neq('rol', 'super_admin'),
      this.supabase
        .from('empresas')
        .select('id, nombre, ruc, estado, fecha_creacion')
        .order('fecha_creacion', { ascending: false })
        .limit(5),
    ]);

    if (ultimasEmpresasRes.error) {
      throw new InternalServerErrorException(ultimasEmpresasRes.error.message);
    }

    return {
      kpis: {
        total_empresas: totalEmpresasRes.count ?? 0,
        empresas_activas: empresasActivasRes.count ?? 0,
        suscripciones_activas: suscripcionesActivasRes.count ?? 0,
        total_usuarios: totalUsuariosRes.count ?? 0,
      },
      ultimas_empresas: ultimasEmpresasRes.data ?? [],
    };
  }

  async getEmpresas(filters: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = this.sanitizeSearch(filters.q);

    let query = this.supabase
      .from('empresas')
      .select('id, nombre, ruc, estado, fecha_creacion', { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,ruc.ilike.%${search}%`);
    }

    const { data: empresas, error, count } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const empresaIds = this.unique((empresas ?? []).map((empresa: any) => empresa.id));

    const [suscripcionesRes, perfilesRes] = await Promise.all([
      empresaIds.length
        ? this.supabase
            .from('suscripciones_empresa')
            .select('empresa_id, plan_id, estado, fecha_inicio, fecha_fin, fecha_creacion')
            .in('empresa_id', empresaIds)
        : Promise.resolve({ data: [], error: null }),
      empresaIds.length
        ? this.supabase
            .from('perfiles')
            .select('empresa_id, rol')
            .in('empresa_id', empresaIds)
            .neq('rol', 'super_admin')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (suscripcionesRes.error) {
      throw new InternalServerErrorException(suscripcionesRes.error.message);
    }

    if (perfilesRes.error) {
      throw new InternalServerErrorException(perfilesRes.error.message);
    }

    const subscriptionsByEmpresa = ((suscripcionesRes.data ?? []) as any[]).reduce((acc: Record<string, any[]>, row: any) => {
      acc[row.empresa_id] = acc[row.empresa_id] ?? [];
      acc[row.empresa_id].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    const planIds = this.unique((suscripcionesRes.data ?? []).map((row: any) => row.plan_id));
    const { data: planes, error: planesError } = planIds.length
      ? await this.supabase
          .from('planes_suscripcion')
          .select('id, nombre')
          .in('id', planIds)
      : { data: [], error: null };

    if (planesError) {
      throw new InternalServerErrorException(planesError.message);
    }

    const planMap = Object.fromEntries((planes ?? []).map((plan: any) => [plan.id, plan.nombre]));
    const usuariosPorEmpresa = ((perfilesRes.data ?? []) as any[]).reduce((acc: Record<string, number>, row: any) => {
      acc[row.empresa_id] = (acc[row.empresa_id] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      rows: (empresas ?? []).map((empresa: any) => {
        const currentSubscription = this.pickCurrentSubscription(subscriptionsByEmpresa[empresa.id] ?? []);

        return {
          ...empresa,
          plan_activo: currentSubscription?.plan_id ? planMap[currentSubscription.plan_id] ?? 'Sin plan' : 'Sin plan',
          usuarios: usuariosPorEmpresa[empresa.id] ?? 0,
        };
      }),
      total: count ?? 0,
      page,
      limit,
    };
  }

  async getEmpresaDetalle(empresaId: string) {
    const { data: empresa, error } = await this.supabase
      .from('empresas')
      .select('id, nombre, ruc, estado, fecha_creacion, webhook_token, modo_asignacion_pedidos')
      .eq('id', empresaId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const [suscripcionesRes, modulosEmpresaRes, perfilesRes] = await Promise.all([
      this.supabase
        .from('suscripciones_empresa')
        .select('id, empresa_id, plan_id, estado, fecha_inicio, fecha_fin, fecha_creacion')
        .eq('empresa_id', empresaId),
      this.supabase
        .from('modulos_empresa')
        .select('modulo_id, activo, fecha_asignacion')
        .eq('empresa_id', empresaId)
        .eq('activo', true),
      this.supabase
        .from('perfiles')
        .select('id, rol')
        .eq('empresa_id', empresaId),
    ]);

    if (suscripcionesRes.error) {
      throw new InternalServerErrorException(suscripcionesRes.error.message);
    }

    if (modulosEmpresaRes.error) {
      throw new InternalServerErrorException(modulosEmpresaRes.error.message);
    }

    if (perfilesRes.error) {
      throw new InternalServerErrorException(perfilesRes.error.message);
    }

    const currentSubscription = this.pickCurrentSubscription(suscripcionesRes.data ?? []);

    let planActual: any = null;
    if (currentSubscription?.plan_id) {
      const { data: plan, error: planError } = await this.supabase
        .from('planes_suscripcion')
        .select('id, nombre, precio, maximo_usuarios, limite_tokens_mensual, limite_ejecuciones_mensual')
        .eq('id', currentSubscription.plan_id)
        .maybeSingle();

      if (planError) {
        throw new InternalServerErrorException(planError.message);
      }

      planActual = plan;
    }

    const moduloIds = this.unique((modulosEmpresaRes.data ?? []).map((row: any) => row.modulo_id));
    const { data: modulos, error: modulosError } = moduloIds.length
      ? await this.supabase
          .from('modulos')
          .select('id, nombre, codigo, descripcion, activo')
          .in('id', moduloIds)
          .order('nombre', { ascending: true })
      : { data: [], error: null };

    if (modulosError) {
      throw new InternalServerErrorException(modulosError.message);
    }

    const usuariosPorRol = (perfilesRes.data ?? []).reduce<Record<string, number>>((acc, row: any) => {
      if (row.rol !== 'super_admin') {
        acc[row.rol] = (acc[row.rol] ?? 0) + 1;
      }
      return acc;
    }, {});

    return {
      empresa,
      suscripcion_actual: currentSubscription
        ? {
            ...currentSubscription,
            plan: planActual,
          }
        : null,
      modulos_activos: modulos ?? [],
      usuarios_por_rol: {
        admin_empresa: usuariosPorRol.admin_empresa ?? 0,
        encargado_sucursal: usuariosPorRol.encargado_sucursal ?? 0,
        vendedor: usuariosPorRol.vendedor ?? 0,
      },
    };
  }

  async updateEmpresaEstado(empresaId: string, estado: EmpresaEstado) {
    if (!['activo', 'suspendido'].includes(estado)) {
      throw new BadRequestException('estado invalido');
    }

    const { data, error } = await this.supabase
      .from('empresas')
      .update({ estado })
      .eq('id', empresaId)
      .select('id, nombre, estado')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return data;
  }

  async getUsuarios(filters: { rol?: string; empresaId?: string; q?: string }) {
    let query = this.supabase
      .from('perfiles')
      .select('id, empresa_id, rol, sucursal_id, fecha_creacion')
      .neq('rol', 'super_admin')
      .order('fecha_creacion', { ascending: false });

    if (filters.rol) {
      query = query.eq('rol', filters.rol);
    }

    if (filters.empresaId) {
      query = query.eq('empresa_id', filters.empresaId);
    }

    const { data: perfiles, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const emailMap = await this.getAuthUsersMap();
    const empresaMap = await this.getEmpresaMap((perfiles ?? []).map((perfil: any) => perfil.empresa_id));
    const sucursalMap = await this.getSucursalMap((perfiles ?? []).map((perfil: any) => perfil.sucursal_id));
    const q = String(filters.q || '').trim().toLowerCase();

    return (perfiles ?? [])
      .map((perfil: any) => ({
        ...perfil,
        email: emailMap[perfil.id] ?? 'Sin email',
        empresa_nombre: empresaMap[perfil.empresa_id] ?? 'Sin empresa',
        sucursal_nombre: perfil.sucursal_id ? sucursalMap[perfil.sucursal_id] ?? 'Sucursal' : '-',
      }))
      .filter((perfil: any) => !q || String(perfil.email || '').toLowerCase().includes(q));
  }

  async getPlanes() {
    const [{ data: planes, error: planesError }, { data: suscripciones, error: subsError }] = await Promise.all([
      this.supabase
        .from('planes_suscripcion')
        .select('id, nombre, limite_tokens_mensual, limite_ejecuciones_mensual, maximo_usuarios, precio, fecha_creacion')
        .order('precio', { ascending: true }),
      this.supabase
        .from('suscripciones_empresa')
        .select('plan_id, empresa_id, estado')
        .eq('estado', 'activa'),
    ]);

    if (planesError) {
      throw new InternalServerErrorException(planesError.message);
    }

    if (subsError) {
      throw new InternalServerErrorException(subsError.message);
    }

    const empresasPorPlan = (suscripciones ?? []).reduce<Record<string, Set<string>>>((acc, row: any) => {
      acc[row.plan_id] = acc[row.plan_id] ?? new Set<string>();
      acc[row.plan_id].add(row.empresa_id);
      return acc;
    }, {});

    return (planes ?? []).map((plan: any) => ({
      ...plan,
      empresas_suscritas: empresasPorPlan[plan.id]?.size ?? 0,
    }));
  }

  async createPlan(dto: PlanPayload) {
    if (!dto.nombre?.trim()) {
      throw new BadRequestException('nombre requerido');
    }

    const payload = {
      nombre: dto.nombre.trim(),
      precio: Number(dto.precio ?? 0),
      maximo_usuarios: Number(dto.maximo_usuarios ?? 0),
      limite_tokens_mensual: Number(dto.limite_tokens_mensual ?? 0),
      limite_ejecuciones_mensual: Number(dto.limite_ejecuciones_mensual ?? 0),
      fecha_creacion: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('planes_suscripcion')
      .insert(payload)
      .select('id, nombre, limite_tokens_mensual, limite_ejecuciones_mensual, maximo_usuarios, precio, fecha_creacion')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async updatePlan(planId: string, dto: PlanPayload) {
    if (!dto.nombre?.trim()) {
      throw new BadRequestException('nombre requerido');
    }

    const payload = {
      nombre: dto.nombre.trim(),
      precio: Number(dto.precio ?? 0),
      maximo_usuarios: Number(dto.maximo_usuarios ?? 0),
      limite_tokens_mensual: Number(dto.limite_tokens_mensual ?? 0),
      limite_ejecuciones_mensual: Number(dto.limite_ejecuciones_mensual ?? 0),
    };

    const { data, error } = await this.supabase
      .from('planes_suscripcion')
      .update(payload)
      .eq('id', planId)
      .select('id, nombre, limite_tokens_mensual, limite_ejecuciones_mensual, maximo_usuarios, precio, fecha_creacion')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new NotFoundException('Plan no encontrado');
    }

    return data;
  }

  async createSuscripcion(dto: {
    empresa_id?: string;
    plan_id?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }) {
    if (!dto.empresa_id || !dto.plan_id || !dto.fecha_inicio || !dto.fecha_fin) {
      throw new BadRequestException('empresa_id, plan_id, fecha_inicio y fecha_fin son requeridos');
    }

    const payload = {
      empresa_id: dto.empresa_id,
      plan_id: dto.plan_id,
      estado: 'activa',
      fecha_inicio: dto.fecha_inicio,
      fecha_fin: dto.fecha_fin,
      fecha_creacion: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('suscripciones_empresa')
      .insert(payload)
      .select('id, empresa_id, plan_id, estado, fecha_inicio, fecha_fin, fecha_creacion')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async getMetricas(mes?: string) {
    const normalizedMes = this.normalizeMes(mes);
    const { start, end } = this.getMonthRange(normalizedMes);

    const [{ data: pedidos, error: pedidosError }, { data: usoRows, error: usoError }] = await Promise.all([
      this.supabase
        .from('pedidos')
        .select('empresa_id, total')
        .gte('fecha_pedido', start)
        .lt('fecha_pedido', end),
      this.supabase
        .from('uso_empresa')
        .select('empresa_id, mes, tokens_usados, cantidad_ejecuciones, ultima_actualizacion')
        .eq('mes', normalizedMes)
        .order('tokens_usados', { ascending: false }),
    ]);

    if (pedidosError) {
      throw new InternalServerErrorException(pedidosError.message);
    }

    if (usoError) {
      throw new InternalServerErrorException(usoError.message);
    }

    const pedidosRows = pedidos ?? [];
    const totalVentasMes = pedidosRows.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
    const totalPedidosMes = pedidosRows.length;
    const pedidosPorEmpresa = pedidosRows.reduce<Record<string, { pedidos: number; total: number }>>((acc, row: any) => {
      acc[row.empresa_id] = acc[row.empresa_id] ?? { pedidos: 0, total: 0 };
      acc[row.empresa_id].pedidos += 1;
      acc[row.empresa_id].total += Number(row.total || 0);
      return acc;
    }, {});

    const usoEmpresaIds = this.unique((usoRows ?? []).map((row: any) => row.empresa_id));
    const pedidoEmpresaIds = this.unique(pedidosRows.map((row: any) => row.empresa_id));
    const empresaMap = await this.getEmpresaMap([...usoEmpresaIds, ...pedidoEmpresaIds]);

    const { data: suscripciones, error: suscripcionesError } = usoEmpresaIds.length
      ? await this.supabase
          .from('suscripciones_empresa')
          .select('empresa_id, plan_id, estado, fecha_creacion')
          .in('empresa_id', usoEmpresaIds)
      : { data: [], error: null };

    if (suscripcionesError) {
      throw new InternalServerErrorException(suscripcionesError.message);
    }

    const subscriptionsByEmpresa = ((suscripciones ?? []) as any[]).reduce((acc: Record<string, any[]>, row: any) => {
      acc[row.empresa_id] = acc[row.empresa_id] ?? [];
      acc[row.empresa_id].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    const planIds = this.unique((suscripciones ?? []).map((row: any) => row.plan_id));
    const { data: planes, error: planesError } = planIds.length
      ? await this.supabase
          .from('planes_suscripcion')
          .select('id, nombre, limite_tokens_mensual, limite_ejecuciones_mensual')
          .in('id', planIds)
      : { data: [], error: null };

    if (planesError) {
      throw new InternalServerErrorException(planesError.message);
    }

    const planMap = Object.fromEntries((planes ?? []).map((plan: any) => [plan.id, plan]));

    const empresasMasActivas = Object.entries(pedidosPorEmpresa)
      .map(([empresaId, metrics]) => ({
        empresa_id: empresaId,
        empresa_nombre: empresaMap[empresaId] ?? 'Empresa',
        pedidos: metrics.pedidos,
        total_ventas: metrics.total,
      }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 5);

    const usoPorEmpresa = (usoRows ?? []).map((row: any) => {
      const currentSubscription = this.pickCurrentSubscription(subscriptionsByEmpresa[row.empresa_id] ?? []);
      const plan = currentSubscription?.plan_id ? planMap[currentSubscription.plan_id] : null;
      const limiteTokens = Number(plan?.limite_tokens_mensual ?? 0);
      const porcentajeLimite = limiteTokens > 0
        ? Math.min(999, (Number(row.tokens_usados || 0) / limiteTokens) * 100)
        : 0;

      return {
        ...row,
        empresa_nombre: empresaMap[row.empresa_id] ?? 'Empresa',
        plan_nombre: plan?.nombre ?? 'Sin plan',
        limite_tokens_mensual: limiteTokens,
        porcentaje_limite: porcentajeLimite,
      };
    });

    return {
      mes: normalizedMes,
      total_ventas_mes: totalVentasMes,
      total_pedidos_mes: totalPedidosMes,
      empresas_mas_activas: empresasMasActivas,
      uso_por_empresa: usoPorEmpresa,
    };
  }

  async getModulos() {
    const [{ data: modulos, error: modulosError }, { data: modulosEmpresa, error: modulosEmpresaError }] = await Promise.all([
      this.supabase
        .from('modulos')
        .select('id, nombre, codigo, descripcion, activo, fecha_creacion')
        .order('nombre', { ascending: true }),
      this.supabase
        .from('modulos_empresa')
        .select('modulo_id, empresa_id')
        .eq('activo', true),
    ]);

    if (modulosError) {
      throw new InternalServerErrorException(modulosError.message);
    }

    if (modulosEmpresaError) {
      throw new InternalServerErrorException(modulosEmpresaError.message);
    }

    const asignadasPorModulo = (modulosEmpresa ?? []).reduce<Record<string, Set<string>>>((acc, row: any) => {
      acc[row.modulo_id] = acc[row.modulo_id] ?? new Set<string>();
      acc[row.modulo_id].add(row.empresa_id);
      return acc;
    }, {});

    return (modulos ?? []).map((modulo: any) => ({
      ...modulo,
      empresas_asignadas: asignadasPorModulo[modulo.id]?.size ?? 0,
    }));
  }

  async updateModuloEstado(moduloId: string, activo: boolean) {
    const { data, error } = await this.supabase
      .from('modulos')
      .update({ activo })
      .eq('id', moduloId)
      .select('id, nombre, codigo, descripcion, activo, fecha_creacion')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new NotFoundException('Modulo no encontrado');
    }

    return data;
  }

  async getAuditoria(filters: {
    empresaId?: string;
    tipoAccion?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase
      .from('registros_auditoria')
      .select('id, empresa_id, usuario_id, tipo_accion, metadatos, estado, fecha_creacion', { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(from, to);

    if (filters.empresaId) {
      query = query.eq('empresa_id', filters.empresaId);
    }

    if (filters.tipoAccion) {
      query = query.eq('tipo_accion', filters.tipoAccion);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const empresaMap = await this.getEmpresaMap((data ?? []).map((row: any) => row.empresa_id));
    const emailMap = await this.getAuthUsersMap();

    return {
      rows: (data ?? []).map((row: any) => ({
        ...row,
        empresa_nombre: empresaMap[row.empresa_id] ?? 'Empresa',
        usuario_email: emailMap[row.usuario_id] ?? 'Sin email',
      })),
      total: count ?? 0,
      page,
      limit,
    };
  }
}
