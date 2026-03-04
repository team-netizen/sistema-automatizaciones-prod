import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolUsuario, type PerfilUsuario } from '@/lib/auth/getRolUsuario'
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard'

type Rol = PerfilUsuario['rol']

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

type EmpresaRow = {
  id: string
  nombre: string | null
  ruc: string | null
  estado: string | null
  fecha_creacion: string | null
}

type PerfilRow = {
  id: string
  empresa_id: string | null
}

type SucursalRow = {
  id: string
  empresa_id: string | null
}

type SuscripcionRow = {
  empresa_id: string | null
  plan_id: string | null
  estado: string | null
}

type PlanRow = {
  id: string
  nombre: string | null
  precio: number | null
}

type PedidoRow = {
  empresa_id: string | null
  fecha_creacion: string | null
  estado: string | null
  total: number | null
}

type EstadoEmpresa = 'activa' | 'prueba' | 'suspendida'

const PLAN_COLORS: Record<string, string> = {
  Starter: '#38bdf8',
  Pro: '#818cf8',
  Enterprise: '#f59e0b',
}

function toNumber(value: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value
}

function normalizeEstado(value: string | null): EstadoEmpresa {
  const estado = (value ?? '').toLowerCase()
  if (estado.includes('suspend')) return 'suspendida'
  if (estado.includes('prueba') || estado.includes('trial')) return 'prueba'
  return 'activa'
}

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return 'Sin actividad'
  const timestamp = new Date(isoDate).getTime()
  if (Number.isNaN(timestamp)) return 'Sin actividad'
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) return 'Hace <1 min'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

export default async function SuperDashboardPage() {
  const perfil = await getRolUsuario()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'super_admin') {
    redirect(rutasPorRol[perfil.rol])
  }

  const supabase = await createClient()

  const [empresasRes, perfilesRes, sucursalesRes, suscripcionesRes, planesRes, pedidosRes, userRes] =
    await Promise.all([
      supabase
        .from('empresas')
        .select('id, nombre, ruc, estado, fecha_creacion')
        .order('fecha_creacion', { ascending: false })
        .limit(300),
      supabase.from('perfiles').select('id, empresa_id'),
      supabase.from('sucursales').select('id, empresa_id'),
      supabase.from('suscripciones_empresa').select('empresa_id, plan_id, estado'),
      supabase.from('planes_suscripcion').select('id, nombre, precio'),
      supabase
        .from('pedidos')
        .select('empresa_id, fecha_creacion, estado, total')
        .order('fecha_creacion', { ascending: false })
        .limit(120),
      supabase.auth.getUser(),
    ])

  const empresas = (empresasRes.data ?? []) as EmpresaRow[]
  const perfiles = (perfilesRes.data ?? []) as PerfilRow[]
  const sucursales = (sucursalesRes.data ?? []) as SucursalRow[]
  const suscripciones = (suscripcionesRes.data ?? []) as SuscripcionRow[]
  const planes = (planesRes.data ?? []) as PlanRow[]
  const pedidos = (pedidosRes.data ?? []) as PedidoRow[]

  const usuariosPorEmpresa = new Map<string, number>()
  perfiles.forEach((row) => {
    if (!row.empresa_id) return
    usuariosPorEmpresa.set(row.empresa_id, (usuariosPorEmpresa.get(row.empresa_id) ?? 0) + 1)
  })

  const sucursalesPorEmpresa = new Map<string, number>()
  sucursales.forEach((row) => {
    if (!row.empresa_id) return
    sucursalesPorEmpresa.set(row.empresa_id, (sucursalesPorEmpresa.get(row.empresa_id) ?? 0) + 1)
  })

  const pedidosPorEmpresa = new Map<string, string | null>()
  pedidos.forEach((row) => {
    if (!row.empresa_id || pedidosPorEmpresa.has(row.empresa_id)) return
    pedidosPorEmpresa.set(row.empresa_id, row.fecha_creacion)
  })

  const planesById = new Map<string, PlanRow>()
  planes.forEach((plan) => {
    planesById.set(plan.id, plan)
  })

  const suscripcionByEmpresa = new Map<string, SuscripcionRow>()
  suscripciones.forEach((row) => {
    if (!row.empresa_id) return
    const current = suscripcionByEmpresa.get(row.empresa_id)
    const currentState = (current?.estado ?? '').toLowerCase()
    const nextState = (row.estado ?? '').toLowerCase()
    if (!current || (!currentState.includes('activa') && nextState.includes('activa'))) {
      suscripcionByEmpresa.set(row.empresa_id, row)
    }
  })

  const empresasMapped = empresas.map((row) => {
    const subscription = suscripcionByEmpresa.get(row.id)
    const plan = subscription?.plan_id ? planesById.get(subscription.plan_id) : null
    const planName = plan?.nombre ?? 'Sin plan'
    const planPrice = toNumber(plan?.precio ?? null)
    const subscriptionActive = (subscription?.estado ?? '').toLowerCase().includes('activa')
    return {
      id: row.id,
      nombre: row.nombre ?? 'Empresa sin nombre',
      ruc: row.ruc ?? '-',
      plan: planName,
      estado: normalizeEstado(row.estado),
      usuarios: usuariosPorEmpresa.get(row.id) ?? 0,
      sucursales: sucursalesPorEmpresa.get(row.id) ?? 0,
      mrr: subscriptionActive ? planPrice : 0,
      ultima_actividad: relativeTime(pedidosPorEmpresa.get(row.id) ?? row.fecha_creacion),
    }
  })

  const mrrTotal = empresasMapped.reduce((sum, item) => sum + item.mrr, 0)
  const empresasActivas = empresasMapped.filter((item) => item.estado === 'activa').length
  const empresasPrueba = empresasMapped.filter((item) => item.estado === 'prueba').length
  const usuariosTotales = perfiles.length

  const planesStatsMap = new Map<string, { nombre: string; precio: number; empresas: number; mrr: number; color: string }>()
  planes.forEach((row) => {
    const name = row.nombre ?? 'Sin plan'
    planesStatsMap.set(name, {
      nombre: name,
      precio: toNumber(row.precio),
      empresas: 0,
      mrr: 0,
      color: PLAN_COLORS[name] ?? '#6b7280',
    })
  })

  empresasMapped.forEach((empresa) => {
    const current = planesStatsMap.get(empresa.plan) ?? {
      nombre: empresa.plan,
      precio: empresa.mrr,
      empresas: 0,
      mrr: 0,
      color: PLAN_COLORS[empresa.plan] ?? '#6b7280',
    }
    current.empresas += 1
    current.mrr += empresa.mrr
    planesStatsMap.set(empresa.plan, current)
  })

  const planesMapped = Array.from(planesStatsMap.values()).sort((a, b) => b.mrr - a.mrr)

  const empresaNombreById = new Map(empresasMapped.map((item) => [item.id, item.nombre]))
  const actividadMapped = pedidos.slice(0, 10).map((pedido) => ({
    empresa: empresaNombreById.get(pedido.empresa_id ?? '') ?? 'Empresa',
    accion: `Pedido ${pedido.estado ?? 'registrado'} por S/ ${toNumber(pedido.total).toFixed(2)}`,
    tiempo: relativeTime(pedido.fecha_creacion),
    tipo: ((pedido.estado ?? '').toLowerCase().includes('cancel')
      ? 'error'
      : (pedido.estado ?? '').toLowerCase().includes('pend')
        ? 'warning'
        : 'success') as 'success' | 'warning' | 'error',
  }))

  const actividad = actividadMapped.length
    ? actividadMapped
    : empresasMapped.slice(0, 5).map((empresa) => ({
        empresa: empresa.nombre,
        accion: 'Empresa registrada en la plataforma',
        tiempo: empresa.ultima_actividad,
        tipo: 'info' as const,
      }))

  return (
    <SuperAdminDashboard
      user={{
        id: perfil.id,
        rol: 'super_admin',
        email: userRes.data.user?.email ?? null,
      }}
      kpis={{
        empresasActivas,
        mrrTotal,
        usuariosTotales,
        empresasPrueba,
      }}
      empresas={empresasMapped}
      planes={planesMapped}
      actividad={actividad}
    />
  )
}
