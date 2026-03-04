import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolUsuario, type PerfilUsuario } from '@/lib/auth/getRolUsuario'
import AdminDashboard from '@/components/dashboards/AdminDashboard'

type Rol = PerfilUsuario['rol']

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

type PedidoMesRow = {
  id: string
  total: number | null
  estado: string | null
}

type StockRow = {
  cantidad: number | null
}

type AlertaRow = {
  id: string
  nivel: string | null
}

type SucursalRow = {
  id: string
  nombre: string
  tipo: string | null
  activa: boolean | null
  prioridad_despacho: number | null
}

type NombreRelacion = { nombre: string | null } | Array<{ nombre: string | null }> | null

type PedidoRecienteRow = {
  id: string
  id_orden: string | null
  estado: string | null
  total: number | null
  nombre_cliente: string | null
  medio_pedido: string | null
  fecha_creacion: string | null
  sucursal_asignada_id: string | null
  canales_venta: NombreRelacion
}

type TransferenciaRow = {
  id: string
  numero_guia: string | null
  estado: string | null
  fecha_creacion: string | null
  sucursal_origen: NombreRelacion
  sucursal_destino: NombreRelacion
}

type IntegracionRow = {
  id: string
  tipo_integracion: string | null
  activa: boolean | null
  ultima_sincronizacion: string | null
  canales_venta: NombreRelacion
}

type SucursalDashboard = {
  id: string
  nombre: string
  tipo: string
  activa: boolean
  stock?: number
  pedidos?: number
}

type PedidoDashboard = {
  id: string
  id_orden: string
  estado: string
  total: number
  nombre_cliente: string
  medio_pedido: string
  fecha_creacion: string
  canal?: string
}

type TransferenciaDashboard = {
  id: string
  numero_guia: string
  estado: string
  fecha_creacion: string
  origen: string
  destino: string
}

type IntegracionDashboard = {
  id: string
  tipo_integracion: string
  activa: boolean
  ultima_sincronizacion: string | null
  canal?: string
}

function getNombreRelacion(relacion: NombreRelacion): string | null {
  if (!relacion) return null
  if (Array.isArray(relacion)) return relacion[0]?.nombre ?? null
  return relacion.nombre ?? null
}

function toNumber(value: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value
}

export default async function AdminDashboardPage() {
  const perfil = await getRolUsuario()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'admin_empresa') {
    redirect(rutasPorRol[perfil.rol])
  }

  const supabase = await createClient()

  const primerDiaMes = new Date()
  primerDiaMes.setDate(1)
  primerDiaMes.setHours(0, 0, 0, 0)

  const [
    pedidosMesRes,
    stockTotalRes,
    alertasRes,
    sucursalesRes,
    pedidosRes,
    transferenciasRes,
    integracionesRes,
  ] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, total, estado')
      .eq('empresa_id', perfil.empresa_id)
      .gte('fecha_creacion', primerDiaMes.toISOString()),
    supabase
      .from('stock_por_sucursal')
      .select('cantidad')
      .eq('empresa_id', perfil.empresa_id),
    supabase
      .from('alertas_generadas')
      .select('id, nivel')
      .eq('empresa_id', perfil.empresa_id)
      .eq('leida', false),
    supabase
      .from('sucursales')
      .select('id, nombre, tipo, activa, prioridad_despacho')
      .eq('empresa_id', perfil.empresa_id),
    supabase
      .from('pedidos')
      .select(
        'id, id_orden, estado, total, nombre_cliente, medio_pedido, fecha_creacion, sucursal_asignada_id, canales_venta(nombre)'
      )
      .eq('empresa_id', perfil.empresa_id)
      .order('fecha_creacion', { ascending: false })
      .limit(10),
    supabase
      .from('transferencias_stock')
      .select(
        'id, numero_guia, estado, fecha_creacion, sucursal_origen:sucursal_origen_id(nombre), sucursal_destino:sucursal_destino_id(nombre)'
      )
      .eq('empresa_id', perfil.empresa_id)
      .order('fecha_creacion', { ascending: false })
      .limit(5),
    supabase
      .from('integraciones_canal')
      .select('id, tipo_integracion, activa, ultima_sincronizacion, canales_venta(nombre)')
      .eq('empresa_id', perfil.empresa_id),
  ])

  const pedidosMes = (pedidosMesRes.data ?? []) as PedidoMesRow[]
  const stockTotal = (stockTotalRes.data ?? []) as StockRow[]
  const alertas = (alertasRes.data ?? []) as AlertaRow[]
  const sucursales = (sucursalesRes.data ?? []) as SucursalRow[]
  const pedidos = (pedidosRes.data ?? []) as PedidoRecienteRow[]
  const transferencias = (transferenciasRes.data ?? []) as TransferenciaRow[]
  const integraciones = (integracionesRes.data ?? []) as IntegracionRow[]

  const ventasMes = pedidosMes.reduce((acc, pedido) => acc + toNumber(pedido.total), 0)
  const pedidosActivos = pedidosMes.filter((pedido) => pedido.estado !== 'cancelado').length
  const stockTotalCantidad = stockTotal.reduce((acc, item) => acc + toNumber(item.cantidad), 0)
  const alertasActivas = alertas.length

  const sucursalesMapeadas: SucursalDashboard[] = sucursales.map((sucursal) => ({
    id: sucursal.id,
    nombre: sucursal.nombre,
    tipo: sucursal.tipo ?? 'sin_tipo',
    activa: sucursal.activa ?? false,
  }))

  const pedidosMapeados: PedidoDashboard[] = pedidos.map((pedido) => ({
    id: pedido.id,
    id_orden: pedido.id_orden ?? pedido.id,
    estado: pedido.estado ?? 'sin_estado',
    total: toNumber(pedido.total),
    nombre_cliente: pedido.nombre_cliente ?? 'Sin cliente',
    medio_pedido: pedido.medio_pedido ?? 'sin_canal',
    fecha_creacion: pedido.fecha_creacion ?? '',
    canal: getNombreRelacion(pedido.canales_venta) ?? undefined,
  }))

  const transferenciasMapeadas: TransferenciaDashboard[] = transferencias.map((transferencia) => ({
    id: transferencia.id,
    numero_guia: transferencia.numero_guia ?? transferencia.id,
    estado: transferencia.estado ?? 'sin_estado',
    fecha_creacion: transferencia.fecha_creacion ?? '',
    origen: getNombreRelacion(transferencia.sucursal_origen) ?? 'N/D',
    destino: getNombreRelacion(transferencia.sucursal_destino) ?? 'N/D',
  }))

  const integracionesMapeadas: IntegracionDashboard[] = integraciones.map((integracion) => ({
    id: integracion.id,
    tipo_integracion: integracion.tipo_integracion ?? 'manual',
    activa: integracion.activa ?? false,
    ultima_sincronizacion: integracion.ultima_sincronizacion,
    canal: getNombreRelacion(integracion.canales_venta) ?? undefined,
  }))

  return (
    <AdminDashboard
      perfil={perfil}
      kpis={{
        ventasMes,
        pedidosActivos,
        stockTotal: stockTotalCantidad,
        alertasActivas,
      }}
      sucursales={sucursalesMapeadas}
      pedidos={pedidosMapeados}
      transferencias={transferenciasMapeadas}
      integraciones={integracionesMapeadas}
    />
  )
}
