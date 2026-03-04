// @ts-nocheck
import { useState, useEffect } from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

// ─── ICON SYSTEM ──────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, color = "currentColor", stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IC = {
  home:        "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  box:         "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  store:       "M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16",
  cart:        "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
  transfer:    "M17 1l4 4-4 4 M3 11V9a4 4 0 014-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 01-4 4H3",
  stock:       "M22 12h-4l-3 9L9 3l-3 9H2",
  link:        "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  bell:        "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  chart:       "M18 20V10 M12 20V4 M6 20v-6",
  users:       "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  settings:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  logout:      "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  trending:    "M23 6l-9.5 9.5-5-5L1 18",
  arrow_right: "M5 12h14 M12 5l7 7-7 7",
  plus:        "M12 5v14 M5 12h14",
  check:       "M20 6L9 17l-5-5",
  x:           "M18 6L6 18 M6 6l12 12",
  sync:        "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15",
  eye:         "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0",
  filter:      "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  search:      "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0",
  edit:        "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  pos:         "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
};

// ─── TOKENS DE DISEÑO ─────────────────────────────────────────────────────────
const T = {
  bg:        "#07090b",
  surface:   "#0b0f12",
  surface2:  "#0f1419",
  border:    "#151d24",
  border2:   "#1c2830",
  accent:    "#00e87b",
  accentDim: "#00e87b18",
  text:      "#e8f0e9",
  textMid:   "#4d6b58",
  textDim:   "#253530",
  font:      "'DM Sans', sans-serif",
  fontMono:  "'DM Mono', monospace",
  fontDisplay: "'Syne', sans-serif",
};

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",      label: "Dashboard",      icon: "home"     },
  { id: "pedidos",        label: "Pedidos",         icon: "cart"     },
  { id: "productos",      label: "Productos",       icon: "box"      },
  { id: "sucursales",     label: "Sucursales",      icon: "store"    },
  { id: "transferencias", label: "Transferencias",  icon: "transfer" },
  { id: "stock",          label: "Stock",           icon: "stock"    },
  { id: "integraciones",  label: "Integraciones",   icon: "link"     },
  { id: "usuarios",       label: "Usuarios",        icon: "users"    },
  { id: "alertas",        label: "Alertas",         icon: "bell"     },
  { id: "reportes",       label: "Reportes",        icon: "chart"    },
];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK = {
  kpis: [
    { label: "Ventas del Mes",    value: "S/ 48,320", delta: "+12.4%", up: true,  icon: "trending" },
    { label: "Pedidos Activos",   value: "37",         delta: "+5 hoy", up: true,  icon: "cart"     },
    { label: "Stock Consolidado", value: "1,284",      delta: "-3.2%",  up: false, icon: "stock"    },
    { label: "Alertas Activas",   value: "2",          delta: "crítico",up: false, icon: "bell"     },
  ],
  pedidos: [
    { id:"PED-0041", canal:"WooCommerce",  cliente:"Carlos Mendoza", total:"S/ 1,250", estado:"pendiente",  sucursal:"Miraflores",  tiempo:"5min" },
    { id:"PED-0040", canal:"Mercado Libre",cliente:"Ana Torres",     total:"S/ 450",   estado:"confirmado", sucursal:"Almacén",     tiempo:"12min"},
    { id:"PED-0039", canal:"WhatsApp",     cliente:"Luis García",    total:"S/ 890",   estado:"pendiente",  sucursal:"San Isidro",  tiempo:"18min"},
    { id:"PED-0038", canal:"Shopify",      cliente:"María Quispe",   total:"S/ 320",   estado:"confirmado", sucursal:"Miraflores",  tiempo:"25min"},
    { id:"PED-0037", canal:"WooCommerce",  cliente:"Jorge Ramos",    total:"S/ 1,700", estado:"cancelado",  sucursal:"Almacén",     tiempo:"1h"  },
  ],
  sucursales: [
    { nombre:"Almacén Central",  tipo:"almacen", stock:840, pedidos:0,  estado:"activa", sync:"2min" },
    { nombre:"Tienda Miraflores",tipo:"tienda",  stock:244, pedidos:18, estado:"activa", sync:"1min" },
    { nombre:"Tienda San Isidro",tipo:"tienda",  stock:200, pedidos:19, estado:"activa", sync:"5min" },
  ],
  transferencias: [
    { guia:"TRF-00003", origen:"Almacén Central", destino:"Tienda Miraflores", items:3, estado:"en_transito", fecha:"Hoy 09:30" },
    { guia:"TRF-00002", origen:"Almacén Central", destino:"Tienda San Isidro", items:5, estado:"recibido",    fecha:"Ayer 16:00"},
    { guia:"TRF-00001", origen:"Tienda Miraflores",destino:"Almacén Central",  items:2, estado:"recibido",    fecha:"Lun 11:00" },
  ],
  integraciones: [
    { nombre:"WooCommerce",   icono:"🛒", estado:"activo",  sync:"3min", pedidos:14, color:"#a78bfa" },
    { nombre:"Mercado Libre", icono:"🛍️", estado:"activo",  sync:"1min", pedidos:19, color:"#fbbf24" },
    { nombre:"Shopify",       icono:"🏪", estado:"activo",  sync:"2min", pedidos:4,  color:"#34d399" },
    { nombre:"WhatsApp",      icono:"💬", estado:"manual",  sync:"Manual",pedidos:4, color:"#4ade80" },
  ],
  usuarios: [
    { nombre:"Rosa Mamani",   email:"rosa@empresa.com",  rol:"encargado_sucursal", sucursal:"Miraflores",  activo:true  },
    { nombre:"Pedro Huanca",  email:"pedro@empresa.com", rol:"encargado_sucursal", sucursal:"San Isidro",  activo:true  },
    { nombre:"Lucia Flores",  email:"lucia@empresa.com", rol:"vendedor",           sucursal:"Miraflores",  activo:true  },
    { nombre:"Marco Quispe",  email:"marco@empresa.com", rol:"vendedor",           sucursal:"Almacén",     activo:false },
  ],
  alertas: [
    { tipo:"stock_critico",   mensaje:"Cámara Digital 4K — stock 2 unidades (mín: 5)", nivel:"critico",  tiempo:"Hace 10min", sucursal:"Almacén"     },
    { tipo:"pedido_sin_asignar", mensaje:"PED-0041 sin sucursal asignada hace 5min",   nivel:"warning",  tiempo:"Hace 5min",  sucursal:"—"           },
    { tipo:"canal_sync",      mensaje:"WhatsApp no sincronizado — requiere revisión",  nivel:"info",     tiempo:"Hace 1h",    sucursal:"—"           },
  ],
};

// ─── BADGES ──────────────────────────────────────────────────────────────────
const Badge = ({ estado }) => {
  const M = {
    pendiente:   ["#f59e0b","#1e1400"],
    confirmado:  ["#10b981","#001a12"],
    cancelado:   ["#ef4444","#1a0000"],
    activo:      ["#10b981","#001a12"],
    activa:      ["#10b981","#001a12"],
    manual:      ["#818cf8","#0e0c1e"],
    en_transito: ["#38bdf8","#001520"],
    recibido:    ["#10b981","#001a12"],
    inactivo:    ["#6b7280","#111"],
  };
  const [c, bg] = M[estado] || ["#6b7280","#111"];
  return (
    <span style={{ background:bg, color:c, padding:"2px 9px", borderRadius:20,
      fontSize:10, fontWeight:700, border:`1px solid ${c}33`,
      fontFamily:T.fontMono, textTransform:"uppercase", letterSpacing:"0.05em" }}>
      {estado.replace("_"," ")}
    </span>
  );
};

const CanalTag = ({ canal }) => {
  const M = { "WooCommerce":["#a78bfa","#130f2a"], "Mercado Libre":["#fbbf24","#1a1400"],
    "WhatsApp":["#4ade80","#0a1a0e"], "Shopify":["#34d399","#051a12"], "Físico":["#94a3b8","#111"] };
  const [c, bg] = M[canal] || ["#94a3b8","#111"];
  return <span style={{ background:bg, color:c, padding:"2px 8px", borderRadius:5,
    fontSize:10, fontWeight:600, border:`1px solid ${c}33`, fontFamily:T.fontMono }}>{canal}</span>;
};

const RolTag = ({ rol }) => {
  const M = { "encargado_sucursal":["#38bdf8","#001520"], "vendedor":["#a78bfa","#130f2a"],
    "admin_empresa":["#00e87b","#001a0f"] };
  const [c, bg] = M[rol] || ["#6b7280","#111"];
  return <span style={{ background:bg, color:c, padding:"2px 9px", borderRadius:20,
    fontSize:10, fontWeight:700, border:`1px solid ${c}33`, fontFamily:T.fontMono,
    textTransform:"uppercase" }}>{rol.replace("_"," ")}</span>;
};

// ─── SECCIÓN HEADER ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, actionLabel }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"13px 20px", borderBottom:`1px solid ${T.border}` }}>
    <span style={{ fontSize:10, fontWeight:700, color:T.textMid,
      letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:T.fontMono }}>{title}</span>
    {action && <button onClick={action} style={{ background:"none", border:`1px solid ${T.border2}`,
      borderRadius:6, padding:"3px 10px", color:T.accent, fontSize:10, cursor:"pointer",
      fontFamily:T.font, fontWeight:600 }}>{actionLabel}</button>}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export const AdminEmpresaDashboard = ({ usuario, onLogout }) => {
  const [nav, setNav]         = useState("dashboard");
  const [expanded, setExp]    = useState(false);
  const [time, setTime]       = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [integraciones, setIntegraciones] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [kpisData, setKpisData] = useState<any>(null);
  const [search, setSearch]   = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const toRows = (payload: any, keys: string[]) => {
      if (Array.isArray(payload)) return payload;
      if (!payload || typeof payload !== "object") return [];
      for (const key of keys) {
        if (Array.isArray(payload[key])) return payload[key];
      }
      return [];
    };

    const loadAll = async () => {
      setLoading(true);
      try {
        const [
          statsRes,
          pedidosRes,
          sucursalesRes,
          transferenciasRes,
          integracionesRes,
          alertasRes,
        ] = await Promise.allSettled([
          operacionesService.getDashboardMetrics(),
          operacionesService.getPedidos(),
          operacionesService.getSucursales(),
          operacionesService.getTransferencias(),
          operacionesService.getIntegraciones(),
          operacionesService.getAlertas(),
        ]);

        if (statsRes.status === "fulfilled") {
          setKpisData(statsRes.value);
          const usuariosRows = toRows(statsRes.value, ["usuarios", "users"]);
          if (usuariosRows.length > 0) {
            setUsuarios(usuariosRows);
          }
        }
        if (pedidosRes.status === "fulfilled") {
          const rows = toRows(pedidosRes.value, ["pedidos", "data", "items"]);
          setPedidos(rows);
        }
        if (sucursalesRes.status === "fulfilled") {
          const rows = toRows(sucursalesRes.value, ["sucursales", "data", "items"]);
          setSucursales(rows);
        }
        if (transferenciasRes.status === "fulfilled") {
          const rows = toRows(transferenciasRes.value, ["transferencias", "data", "items"]);
          setTransferencias(rows);
        }
        if (integracionesRes.status === "fulfilled") {
          const rows = toRows(integracionesRes.value, ["integraciones", "data", "items"]);
          setIntegraciones(rows);
        }
        if (alertasRes.status === "fulfilled") {
          const rows = toRows(alertasRes.value, ["alertas", "data", "items"]);
          setAlertas(rows);
        }
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, []);

  const pedidosMostrar = pedidos.length > 0 ? pedidos : MOCK.pedidos;
  const sucursalesMostrar = sucursales.length > 0 ? sucursales : MOCK.sucursales;
  const transferenciasMostrar = transferencias.length > 0 ? transferencias : MOCK.transferencias;
  const integracionesMostrar = integraciones.length > 0 ? integraciones : MOCK.integraciones;
  const usuariosMostrar = usuarios.length > 0 ? usuarios : MOCK.usuarios;
  const alertasMostrar = alertas.length > 0 ? alertas : MOCK.alertas;

  const metricas = kpisData?.metricas;
  const kpis = metricas
    ? [
        { label: "Ventas del Mes",    value:`S/ ${Number(metricas?.ventas_mes || 0).toLocaleString()}`, delta:"+12.4%", up:true,  icon:"trending" },
        { label: "Pedidos Activos",   value:String(metricas?.pedidos_activos || pedidosMostrar.filter((p: any) => p.estado === "pendiente").length), delta:"+5 hoy", up:true, icon:"cart" },
        { label: "Stock Consolidado", value:String(Number(metricas?.stock_total || 0).toLocaleString()), delta:"-3.2%", up:false, icon:"stock" },
        { label: "Alertas Activas",   value:String(metricas?.alertas_activas || alertasMostrar.length), delta:"activas", up:false, icon:"bell" },
      ]
    : MOCK.kpis;

  const normalizePedido = (p: any) => ({
    id: p?.id ?? p?.codigo ?? "PED-0000",
    canal: p?.canal ?? p?.canal_nombre ?? "FÃ­sico",
    cliente: p?.cliente ?? p?.cliente_nombre ?? "Cliente",
    total: typeof p?.total === "number" ? `S/ ${p.total.toLocaleString()}` : (p?.total ?? "S/ 0"),
    estado: p?.estado ?? "pendiente",
    sucursal: p?.sucursal ?? p?.sucursal_nombre ?? "Sin sucursal",
    tiempo: p?.tiempo ?? p?.created_at ?? "-",
  });

  const normalizeSucursal = (s: any) => ({
    nombre: s?.nombre ?? "Sucursal",
    tipo: s?.tipo ?? "tienda",
    stock: Number(s?.stock_total ?? s?.stock ?? 0),
    pedidos: Number(s?.pedidos_activos ?? s?.pedidos ?? 0),
    estado: s?.estado ?? "activa",
    sync: s?.sync ?? s?.ultima_sync ?? "-",
  });

  const normalizeTransferencia = (t: any) => ({
    guia: t?.guia ?? t?.id ?? "TRF-0000",
    origen: t?.sucursal_origen ?? t?.origen ?? "Origen",
    destino: t?.sucursal_destino ?? t?.destino ?? "Destino",
    items: Number(t?.items ?? t?.total_items ?? 0),
    estado: t?.estado ?? "en_transito",
    fecha: t?.fecha ?? t?.created_at ?? "-",
  });

  const normalizeIntegracion = (c: any) => ({
    nombre: c?.canal ?? c?.nombre ?? "Canal",
    icono: c?.icono ?? "ðŸ”—",
    estado: c?.estado ?? "activo",
    sync: c?.sync ?? c?.ultima_sync ?? "-",
    pedidos: Number(c?.pedidos ?? 0),
    color: c?.color ?? "#34d399",
  });

  const normalizeUsuario = (u: any) => ({
    nombre: u?.nombre ?? "Usuario",
    email: u?.email ?? "-",
    rol: u?.rol ?? "vendedor",
    sucursal: u?.sucursal ?? u?.sucursal_nombre ?? "-",
    activo: typeof u?.activo === "boolean" ? u.activo : true,
  });

  const normalizeAlerta = (a: any) => ({
    tipo: a?.tipo ?? "alerta",
    mensaje: a?.mensaje ?? a?.descripcion ?? "Alerta",
    nivel: a?.nivel ?? "info",
    tiempo: a?.tiempo ?? a?.created_at ?? "-",
    sucursal: a?.sucursal ?? a?.sucursal_nombre ?? "â€”",
  });

  const DATA = {
    ...MOCK,
    kpis,
    pedidos: pedidosMostrar.map(normalizePedido),
    sucursales: sucursalesMostrar.map(normalizeSucursal),
    transferencias: transferenciasMostrar.map(normalizeTransferencia),
    integraciones: integracionesMostrar.map(normalizeIntegracion),
    usuarios: usuariosMostrar.map(normalizeUsuario),
    alertas: alertasMostrar.map(normalizeAlerta),
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:3px;height:3px;}
    ::-webkit-scrollbar-track{background:${T.bg};}
    ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:4px;}
    .sb{transition:width 0.22s cubic-bezier(.4,0,.2,1);}
    .nl{transition:opacity 0.18s,width 0.18s;white-space:nowrap;overflow:hidden;}
    .ni{cursor:pointer;border-left:2px solid transparent;transition:background 0.15s;}
    .ni:hover{background:#0a1410 !important;}
    .ni.on{background:#091410 !important;border-left-color:${T.accent} !important;}
    .kc{transition:transform 0.18s,box-shadow 0.18s;cursor:default;}
    .kc:hover{transform:translateY(-2px);box-shadow:0 8px 32px #00e87b12;}
    .tr:hover{background:#0a1410 !important;}
    .fade{animation:fi 0.3s ease;}
    @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    .pulse{animation:pu 2s infinite;}
    @keyframes pu{0%,100%{opacity:1}50%{opacity:0.3}}
    .btn{cursor:pointer;border:none;transition:opacity 0.15s,transform 0.15s;}
    .btn:hover{opacity:0.85;transform:translateY(-1px);}
    input::placeholder{color:${T.textMid};}
    input{outline:none;}
  `;

  // ── SIDEBAR ──
  const Sidebar = () => (
    <div className="sb" onMouseEnter={() => setExp(true)} onMouseLeave={() => setExp(false)}
      style={{ width:expanded?218:56, background:T.surface, borderRight:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column", flexShrink:0, zIndex:100, height:"100vh",
        position:"sticky", top:0 }}>
      {/* Logo */}
      <div style={{ height:56, display:"flex", alignItems:"center", gap:10,
        paddingLeft:expanded?14:15, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ width:26, height:26, background:`linear-gradient(135deg,${T.accent},#00a854)`,
          borderRadius:7, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#000", fontSize:12, fontWeight:800, fontFamily:T.fontDisplay }}>S</span>
        </div>
        <div className="nl" style={{ opacity:expanded?1:0, width:expanded?"auto":0 }}>
          <div style={{ fontFamily:T.fontDisplay, fontWeight:800, fontSize:12,
            color:T.accent, letterSpacing:"0.06em" }}>SISAUTO</div>
          <div style={{ fontSize:9, color:T.textDim, fontFamily:T.fontMono,
            letterSpacing:"0.06em" }}>ADMIN EMPRESA</div>
        </div>
      </div>
      {/* Nav */}
      <nav style={{ flex:1, padding:"6px 0", overflowY:"auto" }}>
        {NAV.map(item => (
          <div key={item.id} className={`ni ${nav===item.id?"on":""}`}
            onClick={() => setNav(item.id)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0",
              paddingLeft:expanded?14:15, color:nav===item.id?T.accent:T.textMid }}>
            <div style={{ flexShrink:0 }}>
              <Ico d={IC[item.icon]} size={17} color={nav===item.id?T.accent:T.textMid} />
            </div>
            <span className="nl" style={{ opacity:expanded?1:0, width:expanded?"auto":0,
              fontSize:12, fontWeight:nav===item.id?600:400, fontFamily:T.font }}>{item.label}</span>
            {item.id === "alertas" && DATA.alertas.filter(a=>a.nivel==="critico").length > 0 && (
              <span className="nl" style={{ opacity:expanded?1:0,
                background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16,
                fontSize:9, fontWeight:800, display:"flex", alignItems:"center",
                justifyContent:"center", flexShrink:0 }}>
                {DATA.alertas.filter(a=>a.nivel==="critico").length}
              </span>
            )}
          </div>
        ))}
      </nav>
      {/* Bottom */}
      <div style={{ borderTop:`1px solid ${T.border}`, padding:"6px 0" }}>
        {[{id:"settings",label:"Configuración",icon:"settings"},
          {id:"logout",label:"Cerrar Sesión",icon:"logout"}].map(item => (
          <div key={item.id} className="ni"
            onClick={item.id==="logout"?onLogout:undefined}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0",
              paddingLeft:expanded?14:15, color:T.textMid, cursor:"pointer" }}>
            <Ico d={IC[item.icon]} size={17} color={T.textMid} />
            <span className="nl" style={{ opacity:expanded?1:0, width:expanded?"auto":0,
              fontSize:12, fontFamily:T.font }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── TOPBAR ──
  const Topbar = () => (
    <div style={{ height:56, background:T.surface, borderBottom:`1px solid ${T.border}`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 24px", flexShrink:0, position:"sticky", top:0, zIndex:50 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontFamily:T.fontDisplay, fontWeight:800, fontSize:13,
          color:T.accent, letterSpacing:"0.04em" }}>
          {NAV.find(n=>n.id===nav)?.label || "Dashboard"}
        </span>
        <span style={{ color:T.textDim }}>—</span>
        <span style={{ fontSize:11, color:T.textDim, fontFamily:T.fontMono }}>admin_empresa</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          background:T.surface2, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px" }}>
          <span className="pulse" style={{ width:5, height:5, borderRadius:"50%",
            background:T.accent, display:"inline-block" }} />
          <span style={{ fontSize:10, color:T.accent, fontFamily:T.fontMono }}>Sync activo</span>
        </div>
        <span style={{ fontFamily:T.fontMono, fontSize:11, color:T.textDim }}>
          {time.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
        </span>
        <div style={{ position:"relative", cursor:"pointer" }}>
          <Ico d={IC.bell} size={17} color={T.textMid} />
          {DATA.alertas.length > 0 && <span style={{ position:"absolute", top:-3, right:-3,
            width:7, height:7, background:"#ef4444", borderRadius:"50%",
            border:`1px solid ${T.surface}` }} />}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.text }}>
              {usuario?.email || "admin@empresa.com"}
            </div>
            <div style={{ fontSize:9, color:T.accent, fontFamily:T.fontMono,
              letterSpacing:"0.06em" }}>ADMIN EMPRESA</div>
          </div>
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${T.accent},#00a854)`,
            borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:T.fontDisplay, fontWeight:800, fontSize:12, color:"#000" }}>
            {(usuario?.email?.[0] || "A").toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );

  // ── CARD BASE ──
  const Card = ({ children, style={} }) => (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:10, overflow:"hidden", ...style }}>{children}</div>
  );

  // ── VISTA: DASHBOARD ──
  const ViewDashboard = () => (
    <div className="fade" style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {DATA.kpis.map((k,i) => (
          <div key={i} className="kc" style={{ background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:10, padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"flex-start", marginBottom:12 }}>
              <span style={{ fontSize:10, color:T.textMid, fontWeight:600,
                textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.label}</span>
              <div style={{ background:T.accentDim, borderRadius:6, padding:5 }}>
                <Ico d={IC[k.icon]} size={14} color={T.accent} />
              </div>
            </div>
            <div style={{ fontFamily:T.fontDisplay, fontWeight:800, fontSize:26,
              color:T.text, lineHeight:1, marginBottom:6 }}>{k.value}</div>
            <span style={{ fontSize:10, color:k.up?"#10b981":"#ef4444",
              fontFamily:T.fontMono, fontWeight:600 }}>{k.delta}</span>
          </div>
        ))}
      </div>

      {/* Alertas críticas si existen */}
      {DATA.alertas.filter(a=>a.nivel==="critico").map((a,i) => (
        <div key={i} style={{ background:"#1a0500", border:"1px solid #ef444433",
          borderRadius:8, padding:"10px 16px", display:"flex", alignItems:"center",
          gap:10 }}>
          <Ico d={IC.bell} size={14} color="#ef4444" />
          <span style={{ fontSize:12, color:"#ef4444", fontFamily:T.font }}>{a.mensaje}</span>
          <span style={{ marginLeft:"auto", fontSize:10, color:"#ef444488",
            fontFamily:T.fontMono }}>{a.tiempo}</span>
        </div>
      ))}

      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16 }}>
        {/* Pedidos recientes */}
        <Card>
          <SectionHeader title="Pedidos Recientes" action={() => setNav("pedidos")} actionLabel="Ver todos →" />
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.bg }}>
                {["ID","Canal","Cliente","Total","Estado"].map(h => (
                  <th key={h} style={{ padding:"7px 16px", textAlign:"left", fontSize:9,
                    color:T.textDim, fontWeight:700, letterSpacing:"0.09em",
                    textTransform:"uppercase", fontFamily:T.fontMono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA.pedidos.slice(0,4).map((p,i) => (
                <tr key={i} className="tr" style={{ borderTop:`1px solid ${T.border}` }}>
                  <td style={{ padding:"10px 16px", fontSize:11,
                    fontFamily:T.fontMono, color:T.accent }}>{p.id}</td>
                  <td style={{ padding:"10px 16px" }}><CanalTag canal={p.canal} /></td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:T.text }}>{p.cliente}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, fontWeight:700,
                    color:T.text, fontFamily:T.fontMono }}>{p.total}</td>
                  <td style={{ padding:"10px 16px" }}><Badge estado={p.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Sucursales */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Card>
            <SectionHeader title="Sucursales" action={() => setNav("sucursales")} actionLabel="Gestionar →" />
            {DATA.sucursales.map((s,i) => (
              <div key={i} className="tr" style={{ padding:"11px 20px",
                borderTop: i>0?`1px solid ${T.border}`:"none",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{s.nombre}</div>
                  <div style={{ fontSize:10, color:T.textMid, fontFamily:T.fontMono }}>
                    {s.tipo.toUpperCase()} · sync {s.sync}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:T.accent,
                    fontFamily:T.fontMono }}>{s.stock.toLocaleString()}</div>
                  <div style={{ fontSize:9, color:T.textDim }}>unidades</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Canales */}
          <Card>
            <SectionHeader title="Canales" action={() => setNav("integraciones")} actionLabel="Configurar →" />
            {DATA.integraciones.map((c,i) => (
              <div key={i} className="tr" style={{ padding:"9px 20px",
                borderTop: i>0?`1px solid ${T.border}`:"none",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>{c.icono}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:T.text }}>{c.nombre}</div>
                    <div style={{ fontSize:9, color:T.textMid, fontFamily:T.fontMono }}>
                      {c.pedidos} pedidos hoy</div>
                  </div>
                </div>
                <Badge estado={c.estado} />
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Transferencias recientes */}
      <Card>
        <SectionHeader title="Transferencias Recientes"
          action={() => setNav("transferencias")} actionLabel="Ver todas →" />
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:T.bg }}>
              {["Guía","Origen → Destino","Items","Estado","Fecha"].map(h => (
                <th key={h} style={{ padding:"7px 20px", textAlign:"left", fontSize:9,
                  color:T.textDim, fontWeight:700, letterSpacing:"0.09em",
                  textTransform:"uppercase", fontFamily:T.fontMono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA.transferencias.map((t,i) => (
              <tr key={i} className="tr" style={{ borderTop:`1px solid ${T.border}` }}>
                <td style={{ padding:"11px 20px", fontSize:11,
                  fontFamily:T.fontMono, color:T.accent }}>{t.guia}</td>
                <td style={{ padding:"11px 20px", fontSize:12, color:T.text }}>
                  <span style={{ color:T.textMid }}>{t.origen}</span>
                  <span style={{ color:T.textDim, margin:"0 6px" }}>→</span>
                  <span>{t.destino}</span>
                </td>
                <td style={{ padding:"11px 20px", fontSize:12,
                  color:T.textMid, textAlign:"center" }}>{t.items}</td>
                <td style={{ padding:"11px 20px" }}><Badge estado={t.estado} /></td>
                <td style={{ padding:"11px 20px", fontSize:10,
                  color:T.textDim, fontFamily:T.fontMono }}>{t.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ── VISTA: PEDIDOS ──
  const ViewPedidos = () => {
    const filtrados = DATA.pedidos.filter(p =>
      (filterEstado === "todos" || p.estado === filterEstado) &&
      (p.cliente.toLowerCase().includes(search.toLowerCase()) ||
       p.id.toLowerCase().includes(search.toLowerCase()))
    );
    return (
      <div className="fade">
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", gap:6 }}>
            {["todos","pendiente","confirmado","cancelado"].map(f => (
              <button key={f} className="btn"
                onClick={() => setFilterEstado(f)}
                style={{ background: filterEstado===f ? T.accentDim : T.surface,
                  border:`1px solid ${filterEstado===f ? T.accent+"44" : T.border}`,
                  borderRadius:6, padding:"5px 12px",
                  color: filterEstado===f ? T.accent : T.textMid,
                  fontSize:11, fontFamily:T.font, fontWeight:600,
                  textTransform:"capitalize" }}>{f}</button>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8,
            background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:7, padding:"6px 12px" }}>
            <Ico d={IC.search} size={13} color={T.textMid} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pedido o cliente..."
              style={{ background:"none", border:"none", color:T.text,
                fontSize:11, fontFamily:T.font, width:180 }} />
          </div>
        </div>
        <Card>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.bg }}>
                {["ID Pedido","Canal","Cliente","Sucursal","Total","Estado","Tiempo"].map(h => (
                  <th key={h} style={{ padding:"9px 18px", textAlign:"left", fontSize:9,
                    color:T.textDim, fontWeight:700, letterSpacing:"0.09em",
                    textTransform:"uppercase", fontFamily:T.fontMono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p,i) => (
                <tr key={i} className="tr" style={{ borderTop:`1px solid ${T.border}`,
                  cursor:"pointer" }}>
                  <td style={{ padding:"12px 18px", fontSize:11,
                    fontFamily:T.fontMono, color:T.accent }}>{p.id}</td>
                  <td style={{ padding:"12px 18px" }}><CanalTag canal={p.canal} /></td>
                  <td style={{ padding:"12px 18px", fontSize:12, color:T.text }}>{p.cliente}</td>
                  <td style={{ padding:"12px 18px", fontSize:11,
                    color:T.textMid }}>{p.sucursal}</td>
                  <td style={{ padding:"12px 18px", fontSize:13, fontWeight:700,
                    color:T.text, fontFamily:T.fontMono }}>{p.total}</td>
                  <td style={{ padding:"12px 18px" }}><Badge estado={p.estado} /></td>
                  <td style={{ padding:"12px 18px", fontSize:10,
                    color:T.textDim, fontFamily:T.fontMono }}>Hace {p.tiempo}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding:40, textAlign:"center",
                  color:T.textMid, fontSize:12 }}>No se encontraron pedidos</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  // ── VISTA: SUCURSALES ──
  const ViewSucursales = () => (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn" style={{ background:T.accentDim,
          border:`1px solid ${T.accent}44`, borderRadius:8, padding:"8px 16px",
          color:T.accent, fontSize:12, fontFamily:T.font, fontWeight:700,
          display:"flex", alignItems:"center", gap:6 }}>
          <Ico d={IC.plus} size={14} color={T.accent} /> Nueva Sucursal
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {DATA.sucursales.map((s,i) => (
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:10, padding:20, cursor:"pointer", transition:"border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor=T.border2}
            onMouseLeave={e => e.currentTarget.style.borderColor=T.border}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"flex-start", marginBottom:14 }}>
              <div style={{ background:T.accentDim, borderRadius:8, padding:8 }}>
                <Ico d={IC.store} size={18} color={T.accent} />
              </div>
              <Badge estado={s.estado} />
            </div>
            <div style={{ fontFamily:T.fontDisplay, fontWeight:800,
              fontSize:15, color:T.text, marginBottom:4 }}>{s.nombre}</div>
            <div style={{ fontSize:10, color:T.textDim, fontFamily:T.fontMono,
              marginBottom:16, textTransform:"uppercase" }}>{s.tipo}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["Stock",s.stock,"unid.",T.accent],["Pedidos",s.pedidos,"activos","#f59e0b"]].map(([l,v,u,c]) => (
                <div key={l} style={{ background:T.bg, borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:c,
                    fontFamily:T.fontMono }}>{v}</div>
                  <div style={{ fontSize:9, color:T.textDim, textTransform:"uppercase" }}>{u}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:10, color:T.textDim,
              fontFamily:T.fontMono }}>🔄 Sync hace {s.sync}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── VISTA: TRANSFERENCIAS ──
  const ViewTransferencias = () => (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn" style={{ background:T.accentDim,
          border:`1px solid ${T.accent}44`, borderRadius:8, padding:"8px 16px",
          color:T.accent, fontSize:12, fontFamily:T.font, fontWeight:700 }}>
          + Nueva Transferencia
        </button>
      </div>
      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:T.bg }}>
              {["Guía","Origen","Destino","Items","Estado","Fecha","Acciones"].map(h => (
                <th key={h} style={{ padding:"9px 18px", textAlign:"left", fontSize:9,
                  color:T.textDim, fontWeight:700, letterSpacing:"0.09em",
                  textTransform:"uppercase", fontFamily:T.fontMono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA.transferencias.map((t,i) => (
              <tr key={i} className="tr" style={{ borderTop:`1px solid ${T.border}` }}>
                <td style={{ padding:"13px 18px", fontSize:11,
                  fontFamily:T.fontMono, color:T.accent }}>{t.guia}</td>
                <td style={{ padding:"13px 18px", fontSize:12,
                  color:T.textMid }}>{t.origen}</td>
                <td style={{ padding:"13px 18px", fontSize:12, color:T.text }}>{t.destino}</td>
                <td style={{ padding:"13px 18px", fontSize:12,
                  color:T.textMid, textAlign:"center" }}>{t.items}</td>
                <td style={{ padding:"13px 18px" }}><Badge estado={t.estado} /></td>
                <td style={{ padding:"13px 18px", fontSize:10,
                  color:T.textDim, fontFamily:T.fontMono }}>{t.fecha}</td>
                <td style={{ padding:"13px 18px" }}>
                  <button className="btn" style={{ background:T.surface2,
                    border:`1px solid ${T.border2}`, borderRadius:5,
                    padding:"3px 8px", color:T.accent, fontSize:10,
                    fontFamily:T.font }}>Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ── VISTA: INTEGRACIONES ──
  const ViewIntegraciones = () => (
    <div className="fade" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
      {DATA.integraciones.map((c,i) => (
        <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:10, padding:22, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, right:0, width:100, height:100,
            background:`radial-gradient(circle at 100% 0%, ${c.color}12, transparent 70%)`,
            pointerEvents:"none" }} />
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", marginBottom:16 }}>
            <span style={{ fontSize:28 }}>{c.icono}</span>
            <Badge estado={c.estado} />
          </div>
          <div style={{ fontFamily:T.fontDisplay, fontWeight:800,
            fontSize:16, color:T.text, marginBottom:4 }}>{c.nombre}</div>
          <div style={{ fontSize:11, color:T.textDim,
            fontFamily:T.fontMono, marginBottom:18 }}>
            Última sync: hace {c.sync}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            <div style={{ background:T.bg, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:20, fontWeight:800, color:c.color,
                fontFamily:T.fontMono }}>{c.pedidos}</div>
              <div style={{ fontSize:9, color:T.textDim,
                textTransform:"uppercase" }}>Pedidos hoy</div>
            </div>
            <div style={{ background:T.bg, borderRadius:6, padding:10 }}>
              <div style={{ fontSize:13, fontWeight:700,
                color:c.estado==="activo"?"#10b981":"#f59e0b",
                fontFamily:T.fontMono }}>
                {c.estado==="activo"?"SYNC OK":"MANUAL"}
              </div>
              <div style={{ fontSize:9, color:T.textDim,
                textTransform:"uppercase" }}>Estado sync</div>
            </div>
          </div>
          <button className="btn" style={{ width:"100%", background:T.accentDim,
            border:`1px solid ${T.accent}33`, borderRadius:7, padding:8,
            color:T.accent, fontSize:11, fontFamily:T.font, fontWeight:600 }}>
            Configurar integración
          </button>
        </div>
      ))}
    </div>
  );

  // ── VISTA: USUARIOS ──
  const ViewUsuarios = () => (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn" style={{ background:T.accentDim,
          border:`1px solid ${T.accent}44`, borderRadius:8, padding:"8px 16px",
          color:T.accent, fontSize:12, fontFamily:T.font, fontWeight:700 }}>
          + Nuevo Usuario
        </button>
      </div>
      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:T.bg }}>
              {["Usuario","Email","Rol","Sucursal","Estado","Acciones"].map(h => (
                <th key={h} style={{ padding:"9px 18px", textAlign:"left", fontSize:9,
                  color:T.textDim, fontWeight:700, letterSpacing:"0.09em",
                  textTransform:"uppercase", fontFamily:T.fontMono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA.usuarios.map((u,i) => (
              <tr key={i} className="tr" style={{ borderTop:`1px solid ${T.border}` }}>
                <td style={{ padding:"12px 18px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%",
                      background:T.accentDim, border:`1px solid ${T.accent}33`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, fontWeight:800, color:T.accent,
                      fontFamily:T.fontDisplay }}>
                      {u.nombre[0]}
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{u.nombre}</span>
                  </div>
                </td>
                <td style={{ padding:"12px 18px", fontSize:11,
                  color:T.textMid, fontFamily:T.fontMono }}>{u.email}</td>
                <td style={{ padding:"12px 18px" }}><RolTag rol={u.rol} /></td>
                <td style={{ padding:"12px 18px", fontSize:11,
                  color:T.textMid }}>{u.sucursal}</td>
                <td style={{ padding:"12px 18px" }}>
                  <Badge estado={u.activo?"activo":"inactivo"} />
                </td>
                <td style={{ padding:"12px 18px" }}>
                  <div style={{ display:"flex", gap:4 }}>
                    <button className="btn" style={{ background:T.surface2,
                      border:`1px solid ${T.border2}`, borderRadius:5,
                      padding:"3px 8px", color:"#38bdf8", fontSize:10 }}>
                      <Ico d={IC.edit} size={12} color="#38bdf8" />
                    </button>
                    <button className="btn" style={{ background:T.surface2,
                      border:`1px solid ${T.border2}`, borderRadius:5,
                      padding:"3px 8px", color:u.activo?"#ef4444":"#10b981", fontSize:10 }}>
                      <Ico d={u.activo?IC.x:IC.check} size={12}
                        color={u.activo?"#ef4444":"#10b981"} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ── VISTA: ALERTAS ──
  const ViewAlertas = () => (
    <div className="fade" style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {DATA.alertas.map((a,i) => {
        const c = a.nivel==="critico"?"#ef4444":a.nivel==="warning"?"#f59e0b":"#38bdf8";
        return (
          <div key={i} style={{ background:T.surface, border:`1px solid ${c}22`,
            borderLeft:`3px solid ${c}`, borderRadius:8, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ background:`${c}15`, borderRadius:6, padding:7, flexShrink:0 }}>
              <Ico d={IC.bell} size={16} color={c} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.text,
                marginBottom:3 }}>{a.mensaje}</div>
              <div style={{ fontSize:10, color:T.textMid, fontFamily:T.fontMono }}>
                {a.sucursal !== "—" && `${a.sucursal} · `}{a.tiempo}
              </div>
            </div>
            <span style={{ background:`${c}15`, color:c, padding:"3px 10px",
              borderRadius:20, fontSize:10, fontWeight:700,
              fontFamily:T.fontMono, textTransform:"uppercase",
              border:`1px solid ${c}33` }}>{a.nivel}</span>
          </div>
        );
      })}
    </div>
  );

  // ── PLACEHOLDER MÓDULOS ──
  const ViewPlaceholder = ({ label }) => (
    <div className="fade" style={{ display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", height:300, gap:12 }}>
      <div style={{ background:T.surface2, borderRadius:12, padding:20, border:`1px solid ${T.border}` }}>
        <Ico d={IC[NAV.find(n=>n.label===label)?.icon||"home"]} size={32} color={T.textMid} />
      </div>
      <div style={{ fontFamily:T.fontDisplay, fontWeight:700,
        fontSize:16, color:T.textMid }}>{label}</div>
      <div style={{ fontSize:11, color:T.textDim,
        fontFamily:T.fontMono }}>Módulo en construcción</div>
    </div>
  );

  const renderView = () => {
    switch(nav) {
      case "dashboard":      return <ViewDashboard />;
      case "pedidos":        return <ViewPedidos />;
      case "sucursales":     return <ViewSucursales />;
      case "transferencias": return <ViewTransferencias />;
      case "integraciones":  return <ViewIntegraciones />;
      case "usuarios":       return <ViewUsuarios />;
      case "alertas":        return <ViewAlertas />;
      default: return <ViewPlaceholder label={NAV.find(n=>n.id===nav)?.label||nav} />;
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={{ display:"flex", height:"100vh", background:T.bg,
        fontFamily:T.font, color:T.text, overflow:"hidden" }}>
        <Sidebar />
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <Topbar />
          <div style={{ flex:1, overflow:"auto", padding:24 }}>
            {loading && (
              <div style={{ marginBottom:12, fontSize:11, color:T.textMid, fontFamily:T.fontMono }}>
                Cargando datos...
              </div>
            )}
            {renderView()}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminEmpresaDashboard;

