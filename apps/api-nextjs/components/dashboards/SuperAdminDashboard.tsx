'use client'

import { useEffect, useMemo, useState } from 'react'
import { DM_Mono, DM_Sans, Syne } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' })
const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne' })

type EstadoEmpresa = 'activa' | 'prueba' | 'suspendida'
type ActividadTipo = 'success' | 'info' | 'warning' | 'error'
type Nav = 'dashboard' | 'empresas' | 'usuarios' | 'planes' | 'metricas' | 'sistema' | 'alertas'
type Tab = 'todas' | EstadoEmpresa

type SuperAdminDashboardProps = {
  user: { id: string; rol: 'super_admin'; email: string | null }
  kpis: { empresasActivas: number; mrrTotal: number; usuariosTotales: number; empresasPrueba: number }
  empresas: Array<{
    id: string
    nombre: string
    ruc: string
    plan: string
    estado: EstadoEmpresa
    usuarios: number
    sucursales: number
    mrr: number
    ultima_actividad: string
  }>
  planes: Array<{ nombre: string; precio: number; empresas: number; mrr: number; color: string }>
  actividad: Array<{ empresa: string; accion: string; tiempo: string; tipo: ActividadTipo }>
}

const icons = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  building:
    'M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  plan: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  metrics: 'M18 20V10 M12 20V4 M6 20v-6',
  server: 'M2 2h20v8H2z M2 14h20v8H2z M6 6h.01 M6 18h.01',
  alert:
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  dollar: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
} as const

type IconKey = keyof typeof icons

function Icon({ name, color = 'currentColor' }: { name: IconKey; color?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7">
      <path d={icons[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function money(value: number): string {
  return `S/ ${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(value)}`
}

function EstadoBadge({ estado }: { estado: EstadoEmpresa }) {
  const map = {
    activa: ['#10b981', '#002a1a'],
    prueba: ['#f59e0b', '#1e1500'],
    suspendida: ['#ef4444', '#2a0000'],
  } as const
  const [color, bg] = map[estado]
  return (
    <span
      style={{
        background: bg,
        color,
        padding: '2px 9px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        border: `1px solid ${color}44`,
        fontFamily: 'var(--font-dm-mono)',
      }}
    >
      {estado}
    </span>
  )
}

const menu: Array<{ id: Nav; label: string; icon: IconKey }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'empresas', label: 'Empresas', icon: 'building' },
  { id: 'usuarios', label: 'Usuarios', icon: 'users' },
  { id: 'planes', label: 'Planes', icon: 'plan' },
  { id: 'metricas', label: 'Metricas', icon: 'metrics' },
  { id: 'sistema', label: 'Sistema', icon: 'server' },
  { id: 'alertas', label: 'Alertas', icon: 'alert' },
]

export default function SuperAdminDashboard({ user, kpis, empresas, planes, actividad }: SuperAdminDashboardProps) {
  const [nav, setNav] = useState<Nav>('dashboard')
  const [tab, setTab] = useState<Tab>('todas')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const empresasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return empresas.filter((e) => {
      const okTab = tab === 'todas' || e.estado === tab
      if (!okTab) return false
      if (!q) return true
      return e.nombre.toLowerCase().includes(q) || e.ruc.includes(q)
    })
  }, [empresas, search, tab])

  const pageTitle = {
    dashboard: 'Dashboard Global',
    empresas: 'Gestion de Empresas',
    usuarios: 'Usuarios',
    planes: 'Planes y Suscripciones',
    metricas: 'Metricas del SaaS',
    sistema: 'Estado del Sistema',
    alertas: 'Alertas',
  }[nav]

  const kpiCards = [
    { label: 'Empresas activas', value: String(kpis.empresasActivas), icon: 'building' as IconKey, color: '#818cf8' },
    { label: 'MRR total', value: money(kpis.mrrTotal), icon: 'dollar' as IconKey, color: '#34d399' },
    { label: 'Usuarios totales', value: String(kpis.usuariosTotales), icon: 'users' as IconKey, color: '#38bdf8' },
    { label: 'En prueba', value: String(kpis.empresasPrueba), icon: 'activity' as IconKey, color: '#f59e0b' },
  ]

  return (
    <div
      className={`${dmSans.variable} ${dmMono.variable} ${syne.variable}`}
      style={{ display: 'flex', minHeight: '100vh', background: '#08080f', color: '#e2e8f0', fontFamily: 'var(--font-dm-sans)' }}
    >
      <aside
        style={{
          width: expanded ? 215 : 56,
          transition: 'width .22s cubic-bezier(.4,0,.2,1)',
          background: '#06060d',
          borderRight: '1px solid #12122a',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: expanded ? 14 : 16, borderBottom: '1px solid #12122a' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#818cf8,#4f46e5)', display: 'grid', placeItems: 'center' }}>
            <span style={{ color: '#fff', fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 12 }}>S</span>
          </div>
          <div style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ color: '#818cf8', fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 12 }}>SISAUTO</div>
            <div style={{ color: '#2d2d5a', fontFamily: 'var(--font-dm-mono)', fontSize: 9 }}>SUPER ADMIN</div>
          </div>
        </div>
        <nav style={{ paddingTop: 8 }}>
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              style={{
                width: '100%',
                background: nav === item.id ? '#0c0c1e' : 'transparent',
                border: 'none',
                borderLeft: nav === item.id ? '2px solid #818cf8' : '2px solid transparent',
                color: nav === item.id ? '#818cf8' : '#3d3d6b',
                textAlign: 'left',
                padding: expanded ? '10px 14px' : '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <Icon name={item.icon} color={nav === item.id ? '#818cf8' : '#3d3d6b'} />
              <span style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid #12122a', background: '#06060d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#818cf8', fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 800 }}>PANEL DE CONTROL</span>
            <span style={{ color: '#2d2d5a', fontFamily: 'var(--font-dm-mono)', fontSize: 11 }}>SaaS Global</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Icon name="bell" color="#3d3d6b" />
            <span style={{ color: '#2d2d5a', fontSize: 11, fontFamily: 'var(--font-dm-mono)' }}>
              {time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11 }}>{user.email ?? user.id}</div>
              <div style={{ fontSize: 9, color: '#818cf8', fontFamily: 'var(--font-dm-mono)' }}>{user.rol}</div>
            </div>
          </div>
        </header>

        <main style={{ padding: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{pageTitle}</h1>
          <p style={{ color: '#2d2d5a', fontFamily: 'var(--font-dm-mono)', fontSize: 11, marginBottom: 20 }}>
            {time.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          {nav === 'dashboard' && (
            <>
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
                {kpiCards.map((kpi) => (
                  <article key={kpi.label} style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase' }}>{kpi.label}</span>
                      <Icon name={kpi.icon} color={kpi.color} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-syne)', fontSize: 26, fontWeight: 800 }}>{kpi.value}</div>
                  </article>
                ))}
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
                <article style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #0e0e1e', fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase' }}>
                    Empresas recientes
                  </div>
                  {empresas.slice(0, 4).map((empresa) => (
                    <div key={empresa.id} style={{ padding: '11px 18px', borderBottom: '1px solid #0a0a14', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{empresa.nombre}</div>
                        <div style={{ color: '#2d2d5a', fontSize: 10, fontFamily: 'var(--font-dm-mono)' }}>
                          {empresa.sucursales} suc · {empresa.usuarios} usr
                        </div>
                      </div>
                      <EstadoBadge estado={empresa.estado} />
                    </div>
                  ))}
                </article>

                <article style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase', marginBottom: 12 }}>Actividad reciente</div>
                  {actividad.slice(0, 5).map((item, index) => (
                    <div key={`${item.empresa}-${index}`} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{item.empresa}</div>
                      <div style={{ color: '#3d3d6b', fontSize: 10 }}>{item.accion}</div>
                      <div style={{ color: '#2d2d5a', fontSize: 9, fontFamily: 'var(--font-dm-mono)' }}>{item.tiempo}</div>
                    </div>
                  ))}
                </article>
              </section>
            </>
          )}

          {nav === 'empresas' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['todas', 'activa', 'prueba', 'suspendida'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setTab(status)}
                      style={{
                        border: '1px solid #1e1e3a',
                        background: tab === status ? '#0c0c1e' : '#08080f',
                        color: tab === status ? '#818cf8' : '#3d3d6b',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o RUC..."
                  style={{
                    background: '#0a0a18',
                    border: '1px solid #1e1e3a',
                    borderRadius: 7,
                    padding: '6px 12px',
                    color: '#e2e8f0',
                    fontSize: 11,
                    width: 240,
                  }}
                />
              </div>

              <div style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                  <thead>
                    <tr style={{ background: '#08080f' }}>
                      {['Empresa', 'RUC', 'Plan', 'Estado', 'Sucursales', 'Usuarios', 'MRR', 'Ultima actividad'].map((header) => (
                        <th key={header} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#2d2d5a', fontFamily: 'var(--font-dm-mono)' }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.map((empresa) => (
                      <tr key={empresa.id} style={{ borderTop: '1px solid #0a0a14' }}>
                        <td style={{ padding: '12px' }}>{empresa.nombre}</td>
                        <td style={{ padding: '12px', color: '#3d3d6b', fontFamily: 'var(--font-dm-mono)' }}>{empresa.ruc}</td>
                        <td style={{ padding: '12px' }}>{empresa.plan}</td>
                        <td style={{ padding: '12px' }}>
                          <EstadoBadge estado={empresa.estado} />
                        </td>
                        <td style={{ padding: '12px' }}>{empresa.sucursales}</td>
                        <td style={{ padding: '12px' }}>{empresa.usuarios}</td>
                        <td style={{ padding: '12px', color: empresa.mrr > 0 ? '#34d399' : '#3d3d6b' }}>{empresa.mrr > 0 ? money(empresa.mrr) : '-'}</td>
                        <td style={{ padding: '12px', color: '#2d2d5a' }}>{empresa.ultima_actividad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {empresasFiltradas.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: '#2d2d5a' }}>No se encontraron empresas</div>}
              </div>
            </>
          )}

          {nav === 'planes' && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
              {planes.map((plan) => (
                <article key={plan.nombre} style={{ background: '#0a0a18', border: `1px solid ${plan.color}33`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: plan.color, fontFamily: 'var(--font-dm-mono)' }}>{plan.nombre}</div>
                  <div style={{ fontSize: 28, fontFamily: 'var(--font-syne)', margin: '6px 0' }}>
                    {money(plan.precio)}
                    <span style={{ color: '#3d3d6b', fontSize: 12 }}>/mes</span>
                  </div>
                  <div style={{ color: '#2d2d5a', fontSize: 11, marginBottom: 12 }}>{plan.empresas} empresas</div>
                  <div style={{ color: '#34d399', fontFamily: 'var(--font-dm-mono)' }}>MRR: {money(plan.mrr)}</div>
                </article>
              ))}
            </section>
          )}

          {['usuarios', 'metricas', 'sistema', 'alertas'].includes(nav) && (
            <section
              style={{
                background: '#0a0a18',
                border: '1px solid #12122a',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: '#3d3d6b',
                fontFamily: 'var(--font-dm-mono)',
              }}
            >
              Modulo en construccion: {nav}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
