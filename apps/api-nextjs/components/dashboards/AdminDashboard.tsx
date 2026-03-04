'use client'

import { useEffect, useMemo, useState } from 'react'
import { DM_Mono, DM_Sans, Syne } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' })
const syne = Syne({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-syne' })

type AdminDashboardProps = {
  perfil: {
    id: string
    empresa_id: string
    rol: string
    sucursal_id: string | null
  }
  kpis: {
    ventasMes: number
    pedidosActivos: number
    stockTotal: number
    alertasActivas: number
  }
  sucursales: Array<{
    id: string
    nombre: string
    tipo: string
    activa: boolean
    stock?: number
    pedidos?: number
  }>
  pedidos: Array<{
    id: string
    id_orden: string
    estado: string
    total: number
    nombre_cliente: string
    medio_pedido: string
    fecha_creacion: string
    canal?: string
  }>
  transferencias: Array<{
    id: string
    numero_guia: string
    estado: string
    fecha_creacion: string
    origen: string
    destino: string
  }>
  integraciones: Array<{
    id: string
    tipo_integracion: string
    activa: boolean
    ultima_sincronizacion: string | null
    canal?: string
  }>
}

type TabKey = 'resumen' | 'pedidos' | 'sucursales' | 'transferencias' | 'canales'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'sucursales', label: 'Sucursales' },
  { key: 'transferencias', label: 'Transferencias' },
  { key: 'canales', label: 'Canales' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function estadoBadgeClass(estado: string): string {
  const key = estado.toLowerCase()
  if (key.includes('confirm') || key.includes('activ') || key.includes('recib')) {
    return 'bg-[#052a18] text-[#00e87b] border-[#0d5a37]'
  }
  if (key.includes('pend') || key.includes('transito')) {
    return 'bg-[#2a2205] text-[#facc15] border-[#5e4f0f]'
  }
  if (key.includes('cancel') || key.includes('error') || key.includes('inact')) {
    return 'bg-[#2a0c0c] text-[#f87171] border-[#5b1a1a]'
  }
  return 'bg-[#0f1720] text-[#93c5fd] border-[#1e3a8a]'
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AdminDashboard(props: AdminDashboardProps) {
  const { perfil, kpis, sucursales, pedidos, transferencias, integraciones } = props
  const [activeTab, setActiveTab] = useState<TabKey>('resumen')
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const reloj = useMemo(
    () =>
      now.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [now]
  )

  return (
    <div
      className={`${dmSans.variable} ${dmMono.variable} ${syne.variable} min-h-screen bg-[#080c0e] text-white`}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="group/sidebar h-screen w-[60px] hover:w-[220px] transition-all duration-300 border-r border-[#123524] bg-[#070b0d] overflow-hidden">
          <div className="flex h-14 items-center gap-3 px-5 border-b border-[#103120]">
            <div className="h-2.5 w-2.5 rounded-full bg-[#00e87b]" />
            <span
              className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity whitespace-nowrap text-[13px] tracking-[0.14em]"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              SISAUTO
            </span>
          </div>

          <nav className="p-3 space-y-2 text-[#9fb3a8]">
            <button className="flex w-full items-center gap-3 rounded-lg border border-[#113322] bg-[#0a1114] px-3 py-2 text-[#00e87b]">
              <Icon path="M3 12h18M12 3v18" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-sm">Dashboard</span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#0a1114]">
              <Icon path="M4 7h16M4 12h16M4 17h16" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-sm">Pedidos</span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#0a1114]">
              <Icon path="M4 19h16V5H4v14zm4-10h8m-8 4h8" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-sm">Stock</span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#0a1114]">
              <Icon path="M5 12h14M12 5l7 7-7 7" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-sm">
                Transferencias
              </span>
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="h-14 border-b border-[#123524] bg-[#070b0d] px-5 flex items-center justify-between">
            <h1 className="text-sm tracking-[0.14em] text-[#9fb3a8]" style={{ fontFamily: 'var(--font-dm-mono)' }}>
              PANEL ADMINISTRATIVO
            </h1>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-zinc-400">Email:</span>
              <span className="text-zinc-200">{perfil.id}</span>
              <span className="rounded-md border border-[#184d34] bg-[#0a1712] px-2 py-1 text-[#00e87b]">{perfil.rol}</span>
              <span className="text-zinc-300" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {reloj}
              </span>
            </div>
          </header>

          <main className="p-5">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-[#184d34] bg-[#0b1412] p-4">
                <p className="text-xs text-zinc-400">Ventas mes</p>
                <p className="mt-2 text-2xl font-semibold text-[#00e87b]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {formatCurrency(kpis.ventasMes)}
                </p>
              </article>
              <article className="rounded-xl border border-[#184d34] bg-[#0b1412] p-4">
                <p className="text-xs text-zinc-400">Pedidos activos</p>
                <p className="mt-2 text-2xl font-semibold text-[#00e87b]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {kpis.pedidosActivos}
                </p>
              </article>
              <article className="rounded-xl border border-[#184d34] bg-[#0b1412] p-4">
                <p className="text-xs text-zinc-400">Stock total</p>
                <p className="mt-2 text-2xl font-semibold text-[#00e87b]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {kpis.stockTotal}
                </p>
              </article>
              <article className="rounded-xl border border-[#184d34] bg-[#0b1412] p-4">
                <p className="text-xs text-zinc-400">Alertas</p>
                <p className="mt-2 text-2xl font-semibold text-[#00e87b]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {kpis.alertasActivas}
                </p>
              </article>
            </section>

            <section className="mt-5 rounded-xl border border-[#133826] bg-[#0a1114]">
              <div className="border-b border-[#123524] px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${
                        activeTab === tab.key
                          ? 'bg-[#00e87b] text-black'
                          : 'bg-[#0b1412] text-zinc-300 hover:bg-[#101b17]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {activeTab === 'resumen' && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-[#184d34] bg-[#0b1412] p-4">
                      <h3 className="mb-3 text-sm text-zinc-300">Pedidos recientes</h3>
                      <div className="space-y-2">
                        {pedidos.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-md bg-[#0a0f11] px-3 py-2 text-sm">
                            <span className="text-zinc-200">{p.id_orden}</span>
                            <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(p.estado)}`}>{p.estado}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#184d34] bg-[#0b1412] p-4">
                      <h3 className="mb-3 text-sm text-zinc-300">Sincronizaciones</h3>
                      <div className="space-y-2">
                        {integraciones.slice(0, 5).map((i) => (
                          <div key={i.id} className="flex items-center justify-between rounded-md bg-[#0a0f11] px-3 py-2 text-sm">
                            <span className="capitalize text-zinc-200">{i.tipo_integracion}</span>
                            <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(i.activa ? 'activo' : 'inactivo')}`}>
                              {i.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'pedidos' && (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="text-left text-zinc-400 border-b border-[#123524]">
                          <th className="py-2 pr-3">ID Orden</th>
                          <th className="py-2 pr-3">Cliente</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Canal</th>
                          <th className="py-2 pr-3">Total</th>
                          <th className="py-2 pr-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidos.map((p) => (
                          <tr key={p.id} className="border-b border-[#10281d]">
                            <td className="py-2 pr-3 text-zinc-200">{p.id_orden}</td>
                            <td className="py-2 pr-3">{p.nombre_cliente}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(p.estado)}`}>{p.estado}</span>
                            </td>
                            <td className="py-2 pr-3">{p.canal ?? p.medio_pedido}</td>
                            <td className="py-2 pr-3 text-[#00e87b]">{formatCurrency(p.total)}</td>
                            <td className="py-2 pr-3 text-zinc-400">{p.fecha_creacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'sucursales' && (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="text-left text-zinc-400 border-b border-[#123524]">
                          <th className="py-2 pr-3">Nombre</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Stock</th>
                          <th className="py-2 pr-3">Pedidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sucursales.map((s) => (
                          <tr key={s.id} className="border-b border-[#10281d]">
                            <td className="py-2 pr-3 text-zinc-200">{s.nombre}</td>
                            <td className="py-2 pr-3">{s.tipo}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(s.activa ? 'activo' : 'inactivo')}`}>
                                {s.activa ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td className="py-2 pr-3">{s.stock ?? 0}</td>
                            <td className="py-2 pr-3">{s.pedidos ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'transferencias' && (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[840px] text-sm">
                      <thead>
                        <tr className="text-left text-zinc-400 border-b border-[#123524]">
                          <th className="py-2 pr-3">Guía</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Origen</th>
                          <th className="py-2 pr-3">Destino</th>
                          <th className="py-2 pr-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferencias.map((t) => (
                          <tr key={t.id} className="border-b border-[#10281d]">
                            <td className="py-2 pr-3 text-zinc-200">{t.numero_guia}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(t.estado)}`}>{t.estado}</span>
                            </td>
                            <td className="py-2 pr-3">{t.origen}</td>
                            <td className="py-2 pr-3">{t.destino}</td>
                            <td className="py-2 pr-3 text-zinc-400">{t.fecha_creacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'canales' && (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="text-left text-zinc-400 border-b border-[#123524]">
                          <th className="py-2 pr-3">Canal</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Última sincronización</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integraciones.map((i) => (
                          <tr key={i.id} className="border-b border-[#10281d]">
                            <td className="py-2 pr-3 text-zinc-200">{i.canal ?? '-'}</td>
                            <td className="py-2 pr-3 capitalize">{i.tipo_integracion}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded border px-2 py-0.5 text-xs ${estadoBadgeClass(i.activa ? 'activo' : 'inactivo')}`}>
                                {i.activa ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-zinc-400">{i.ultima_sincronizacion ?? 'Sin sync'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
