import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type EstadoEmpresa = 'activa' | 'prueba' | 'suspendida';
type Tab = 'todas' | EstadoEmpresa;
type Nav = 'dashboard' | 'empresas' | 'usuarios' | 'planes' | 'metricas' | 'sistema' | 'alertas';

interface SuperAdminDashboardProps {
  usuario?: {
    email?: string;
    rol?: string;
  };
}

type Empresa = {
  id: string;
  nombre: string;
  ruc: string;
  plan: 'Starter' | 'Pro' | 'Enterprise';
  estado: EstadoEmpresa;
  usuarios: number;
  sucursales: number;
  mrr: number;
  ultima_actividad: string;
};

const empresasData: Empresa[] = [
  { id: 'E001', nombre: 'Tienda Organa', ruc: '20601234567', plan: 'Pro', estado: 'activa', usuarios: 8, sucursales: 3, mrr: 299, ultima_actividad: 'Hace 2 min' },
  { id: 'E002', nombre: 'Ambar Joyeria', ruc: '20712345678', plan: 'Starter', estado: 'activa', usuarios: 3, sucursales: 1, mrr: 99, ultima_actividad: 'Hace 18 min' },
  { id: 'E003', nombre: 'El Granero de Lima', ruc: '20823456789', plan: 'Pro', estado: 'activa', usuarios: 12, sucursales: 4, mrr: 299, ultima_actividad: 'Hace 1 h' },
  { id: 'E004', nombre: 'Melissa Peru', ruc: '20934567890', plan: 'Enterprise', estado: 'activa', usuarios: 25, sucursales: 8, mrr: 599, ultima_actividad: 'Hace 5 min' },
  { id: 'E005', nombre: 'TechStore Lima', ruc: '20145678901', plan: 'Starter', estado: 'prueba', usuarios: 2, sucursales: 1, mrr: 0, ultima_actividad: 'Hace 3 h' },
  { id: 'E006', nombre: 'Moda Express SAC', ruc: '20256789012', plan: 'Pro', estado: 'suspendida', usuarios: 5, sucursales: 2, mrr: 0, ultima_actividad: 'Hace 5 d' },
];

const planesData = [
  { nombre: 'Starter', precio: 99, color: '#38bdf8' },
  { nombre: 'Pro', precio: 299, color: '#818cf8' },
  { nombre: 'Enterprise', precio: 599, color: '#f59e0b' },
] as const;

function Icon({ path, color = 'currentColor' }: { path: string; color?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const I = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  building: 'M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  plan: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  metrics: 'M18 20V10 M12 20V4 M6 20v-6',
  alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  server: 'M2 2h20v8H2z M2 14h20v8H2z M6 6h.01 M6 18h.01',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
} as const;

function estadoStyle(estado: EstadoEmpresa): CSSProperties {
  const map: Record<EstadoEmpresa, { bg: string; color: string }> = {
    activa: { bg: '#002a1a', color: '#10b981' },
    prueba: { bg: '#1e1500', color: '#f59e0b' },
    suspendida: { bg: '#2a0000', color: '#ef4444' },
  };
  return {
    background: map[estado].bg,
    color: map[estado].color,
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    border: `1px solid ${map[estado].color}44`,
  };
}

function planColor(plan: Empresa['plan']): string {
  if (plan === 'Starter') return '#38bdf8';
  if (plan === 'Pro') return '#818cf8';
  return '#f59e0b';
}

export function SuperAdminDashboard({ usuario }: SuperAdminDashboardProps) {
  const [nav, setNav] = useState<Nav>('dashboard');
  const [tab, setTab] = useState<Tab>('todas');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const empresasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return empresasData.filter((e) => {
      const byTab = tab === 'todas' || e.estado === tab;
      const bySearch = q.length === 0 || e.nombre.toLowerCase().includes(q) || e.ruc.includes(q);
      return byTab && bySearch;
    });
  }, [search, tab]);

  const kpis = useMemo(() => {
    const empresasActivas = empresasData.filter((e) => e.estado === 'activa').length;
    const mrrTotal = empresasData.filter((e) => e.estado === 'activa').reduce((a, e) => a + e.mrr, 0);
    const usuariosTotales = empresasData.reduce((a, e) => a + e.usuarios, 0);
    const enPrueba = empresasData.filter((e) => e.estado === 'prueba').length;
    return { empresasActivas, mrrTotal, usuariosTotales, enPrueba };
  }, []);

  const css = `
    .sa-scroll::-webkit-scrollbar{width:4px;height:4px}
    .sa-scroll::-webkit-scrollbar-thumb{background:#1e1e3a;border-radius:4px}
    .sa-td{padding:12px 16px;border-top:1px solid #0a0a14;font-size:12px}
    .sa-th{padding:9px 16px;text-align:left;font-size:9px;color:#2d2d5a;letter-spacing:.09em;text-transform:uppercase}
    .sa-tab{background:none;border:none;padding:6px 16px;font-size:11px;color:#3d3d6b;cursor:pointer}
    .sa-tab.on{border-bottom:2px solid #818cf8;color:#818cf8}
  `;

  return (
    <>
      <style>{css}</style>
      <div style={{ display: 'flex', minHeight: '100%', background: '#08080f', color: '#e2e8f0' }}>
        <aside
          style={{
            width: expanded ? 215 : 56,
            background: '#06060d',
            borderRight: '1px solid #12122a',
            transition: 'width .22s cubic-bezier(.4,0,.2,1)',
            flexShrink: 0,
          }}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <div style={{ height: 56, borderBottom: '1px solid #12122a', display: 'flex', alignItems: 'center', paddingLeft: expanded ? 14 : 16, gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#818cf8,#4f46e5)', display: 'grid', placeItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>S</span>
            </div>
            <div style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#818cf8' }}>SISAUTO</div>
              <div style={{ fontSize: 9, color: '#2d2d5a', letterSpacing: '.08em' }}>SUPER ADMIN</div>
            </div>
          </div>

          <div style={{ paddingTop: 6 }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: I.grid },
              { id: 'empresas', label: 'Empresas', icon: I.building },
              { id: 'usuarios', label: 'Usuarios', icon: I.users },
              { id: 'planes', label: 'Planes', icon: I.plan },
              { id: 'metricas', label: 'Metricas', icon: I.metrics },
              { id: 'sistema', label: 'Sistema', icon: I.server },
              { id: 'alertas', label: 'Alertas', icon: I.alert },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setNav(item.id as Nav)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: 'none',
                  borderLeft: nav === item.id ? '2px solid #818cf8' : '2px solid transparent',
                  background: nav === item.id ? '#0c0c1e' : 'transparent',
                  color: nav === item.id ? '#818cf8' : '#3d3d6b',
                  cursor: 'pointer',
                  padding: expanded ? '9px 14px' : '9px 16px',
                }}
              >
                <Icon path={item.icon} color={nav === item.id ? '#818cf8' : '#3d3d6b'} />
                <span style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 56, background: '#06060d', borderBottom: '1px solid #12122a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#818cf8' }}>PANEL DE CONTROL</span>
              <span style={{ fontSize: 11, color: '#2d2d5a' }}>SaaS Global</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Icon path={I.bell} color="#3d3d6b" />
              <span style={{ fontSize: 11, color: '#2d2d5a' }}>
                {time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11 }}>{usuario?.email ?? 'superadmin'}</div>
                <div style={{ fontSize: 9, color: '#818cf8' }}>SUPER ADMIN</div>
              </div>
            </div>
          </div>

          <div className="sa-scroll" style={{ height: 'calc(100vh - 56px)', overflow: 'auto', padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              {nav === 'dashboard' ? 'Dashboard Global' : nav === 'empresas' ? 'Gestion de Empresas' : nav === 'planes' ? 'Planes y Suscripciones' : 'Modulo en construccion'}
            </h1>
            <p style={{ fontSize: 11, color: '#2d2d5a', marginBottom: 22 }}>
              {time.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            {nav === 'dashboard' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Empresas Activas', value: String(kpis.empresasActivas), color: '#818cf8', icon: I.building },
                    { label: 'MRR Total', value: `S/ ${kpis.mrrTotal.toLocaleString()}`, color: '#34d399', icon: I.metrics },
                    { label: 'Usuarios Totales', value: String(kpis.usuariosTotales), color: '#38bdf8', icon: I.users },
                    { label: 'En Prueba', value: String(kpis.enPrueba), color: '#f59e0b', icon: I.alert },
                  ].map((k) => (
                    <div key={k.label} style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase' }}>{k.label}</span>
                        <Icon path={k.icon} color={k.color} />
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
                  <div style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '13px 18px', borderBottom: '1px solid #0e0e1e', fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase' }}>
                      Empresas recientes
                    </div>
                    {empresasData.slice(0, 4).map((e) => (
                      <div key={e.id} style={{ padding: '11px 18px', borderBottom: '1px solid #0a0a14', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{e.nombre}</div>
                          <div style={{ fontSize: 10, color: '#2d2d5a' }}>{e.sucursales} suc · {e.usuarios} usr</div>
                        </div>
                        <div style={estadoStyle(e.estado)}>{e.estado}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontSize: 10, color: '#3d3d6b', textTransform: 'uppercase', marginBottom: 12 }}>MRR por plan</div>
                    {planesData.map((p) => {
                      const empresasPlan = empresasData.filter((e) => e.plan === p.nombre);
                      const mrr = empresasPlan.reduce((a, e) => a + e.mrr, 0);
                      return (
                        <div key={p.nombre} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11 }}>{p.nombre}</span>
                            <span style={{ color: p.color, fontSize: 11 }}>S/ {mrr.toLocaleString()}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 4, background: '#0e0e1e' }}>
                            <div style={{ width: `${(empresasPlan.length / empresasData.length) * 100}%`, height: '100%', borderRadius: 4, background: p.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {nav === 'empresas' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #12122a' }}>
                    {(['todas', 'activa', 'prueba', 'suspendida'] as const).map((item) => (
                      <button key={item} className={`sa-tab ${tab === item ? 'on' : ''}`} onClick={() => setTab(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o RUC..."
                    style={{ background: '#0a0a18', border: '1px solid #1e1e3a', borderRadius: 7, padding: '6px 12px', color: '#e2e8f0', fontSize: 11, width: 220 }}
                  />
                </div>

                <div style={{ background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
                    <thead>
                      <tr style={{ background: '#08080f' }}>
                        {['Empresa', 'RUC', 'Plan', 'Estado', 'Sucursales', 'Usuarios', 'MRR', 'Ultima actividad'].map((h) => <th key={h} className="sa-th">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {empresasFiltradas.map((e) => (
                        <tr key={e.id}>
                          <td className="sa-td">{e.nombre}</td>
                          <td className="sa-td" style={{ color: '#3d3d6b' }}>{e.ruc}</td>
                          <td className="sa-td"><span style={{ color: planColor(e.plan) }}>{e.plan}</span></td>
                          <td className="sa-td"><span style={estadoStyle(e.estado)}>{e.estado}</span></td>
                          <td className="sa-td">{e.sucursales}</td>
                          <td className="sa-td">{e.usuarios}</td>
                          <td className="sa-td" style={{ color: e.mrr > 0 ? '#34d399' : '#3d3d6b' }}>{e.mrr > 0 ? `S/ ${e.mrr}` : '-'}</td>
                          <td className="sa-td" style={{ color: '#2d2d5a' }}>{e.ultima_actividad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {nav === 'planes' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
                {planesData.map((p) => {
                  const count = empresasData.filter((e) => e.plan === p.nombre).length;
                  return (
                    <div key={p.nombre} style={{ background: '#0a0a18', border: `1px solid ${p.color}33`, borderRadius: 12, padding: 22 }}>
                      <div style={{ fontSize: 10, color: p.color, textTransform: 'uppercase', marginBottom: 8 }}>{p.nombre}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>
                        S/ {p.precio}
                        <span style={{ fontSize: 12, color: '#3d3d6b' }}>/mes</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#3d3d6b' }}>{count} empresas</div>
                    </div>
                  );
                })}
              </div>
            )}

            {['usuarios', 'metricas', 'sistema', 'alertas'].includes(nav) && (
              <div style={{ height: 300, display: 'grid', placeItems: 'center', background: '#0a0a18', border: '1px solid #12122a', borderRadius: 10, color: '#3d3d6b' }}>
                Modulo en construccion: {nav}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
