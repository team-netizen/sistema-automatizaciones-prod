// @ts-nocheck
import { Fragment, useEffect, useState } from 'react';
import { operacionesService } from '../../modules/operaciones/services/operacionesService';

const Ico = ({ d, size = 18, color = "currentColor", stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IC = {
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0",
};

const T = {
  bg: "#07090b",
  surface: "#0b0f12",
  surface2: "#0f1419",
  border: "#151d24",
  border2: "#1c2830",
  accent: "#00e87b",
  accentDim: "#00e87b18",
  text: "#e8f0e9",
  textMid: "#4d6b58",
  textDim: "#253530",
  font: "'DM Sans', sans-serif",
  fontMono: "'DM Mono', monospace",
  fontDisplay: "'Syne', sans-serif",
};

const Card = ({ children, style={} }) => (
  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden", ...style }}>{children}</div>
);

interface ViewProductosProps {
  usuario?: any;
}

export const ViewProductos = ({ usuario }: ViewProductosProps) => {
  void usuario;
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'editar'>('crear');
  const [productoEditandoId, setProductoEditandoId] = useState<string | null>(null);
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [errorNuevoProducto, setErrorNuevoProducto] = useState('');
  const [eliminandoProducto, setEliminandoProducto] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [archivoCSV, setArchivoCSV] = useState<File | null>(null);
  const [previewCSV, setPreviewCSV] = useState<any[]>([]);
  const [totalCSV, setTotalCSV] = useState(0);
  const [importandoCSV, setImportandoCSV] = useState(false);
  const [progresoCSV, setProgresoCSV] = useState({ actual: 0, total: 0 });
  const [resultadoImportacion, setResultadoImportacion] = useState<any | null>(null);
  const [errorImportacion, setErrorImportacion] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState<'productos' | 'categorias'>('productos');
  const [categorias, setCategorias] = useState<any[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);
  const [categoriasList, setCategoriasList] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<any>(null);
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [descripcionCategoria, setDescripcionCategoria] = useState('');
  const [activaCategoria, setActivaCategoria] = useState(true);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState('');
  const [eliminandoCategoriaId, setEliminandoCategoriaId] = useState<string | null>(null);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [stockInicial, setStockInicial] = useState<Record<string, number>>({});
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: '',
    sku: '',
    categoria_id: null as string | null,
    descripcion: '',
    precio: '',
    stock_minimo: 0,
    activo: true,
  });

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await operacionesService.getProductos();
      setProductos(res?.productos || []);
    } catch {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarProductos();
  }, []);

  const toggleActivo = async (productoId: string, activoActual: boolean) => {
    try {
      await operacionesService.toggleProductoActivo(productoId, !activoActual);
      setProductos((prev) =>
        prev.map((p) => (String(p?.id ?? '') === productoId ? { ...p, activo: !activoActual } : p)),
      );
    } catch (err) {
      console.error('Error al cambiar estado del producto:', err);
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda =
      String(p?.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      String(p?.sku ?? '').toLowerCase().includes(busqueda.toLowerCase());

    const categoriaId = String(p?.categoria_id ?? '');
    const coincideCategoria =
      filtroCategoria === 'todas'
        ? true
        : filtroCategoria === 'sin_categoria'
          ? !categoriaId
          : categoriaId === filtroCategoria;

    return coincideBusqueda && coincideCategoria;
  });

  const cargarCategoriasModal = async () => {
    setCargandoCategorias(true);
    try {
      const res = await operacionesService.getCategorias({ solo_activas: true });
      const rows = Array.isArray(res?.categorias) ? res.categorias : [];
      setCategorias(
        rows.map((cat: any) => ({
          ...cat,
          activa: Boolean(cat?.activa ?? cat?.activo ?? true),
        })),
      );
    } catch {
      setCategorias([]);
    } finally {
      setCargandoCategorias(false);
    }
  };

  const cargarCategoriasGestion = async () => {
    setLoadingCats(true);
    try {
      const res = await operacionesService.getCategorias({ incluir_inactivas: true });
      const rows = Array.isArray(res?.categorias) ? res.categorias : [];
      setCategoriasList(
        rows.map((cat: any) => ({
          ...cat,
          activa: Boolean(cat?.activa ?? cat?.activo ?? true),
        })),
      );
    } catch {
      setCategoriasList([]);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    void cargarCategoriasModal();
  }, []);

  useEffect(() => {
    if (pestanaActiva === 'categorias') {
      void cargarCategoriasGestion();
    }
  }, [pestanaActiva]);

  const parseCsvLine = (line: string) => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    out.push(current.trim());
    return out;
  };

  const procesarCsvPreview = (text: string) => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setPreviewCSV([]);
      setTotalCSV(0);
      return;
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    const data = rows.map((cols) => {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
      return row;
    });

    setTotalCSV(data.length);
    setPreviewCSV(data.slice(0, 5));
  };

  const exportarProductosCSV = () => {
    const sucursalesUnicas: string[] = [];
    productos.forEach((p) => {
      (p?.stock_por_sucursal || []).forEach((s: any) => {
        if (s?.sucursal_nombre && !sucursalesUnicas.includes(s.sucursal_nombre)) {
          sucursalesUnicas.push(s.sucursal_nombre);
        }
      });
    });

    const headers = [
      'nombre',
      'sku',
      'categoria',
      'precio',
      'stock_total',
      ...sucursalesUnicas,
      'estado',
    ].join(',');

    const filas = productos.map((p) => {
      const categoriaNombre = p?.categoria?.nombre
        || categorias.find((c: any) => String(c?.id ?? '') === String(p?.categoria_id ?? ''))?.nombre
        || p?.categoria_id
        || 'Sin categoria';

      const stockPorSucursal: Record<string, number> = {};
      (p?.stock_por_sucursal || []).forEach((s: any) => {
        if (s?.sucursal_nombre) {
          stockPorSucursal[s.sucursal_nombre] = s.cantidad || 0;
        }
      });

      return [
        `"${p?.nombre || ''}"`,
        p?.sku || '',
        `"${categoriaNombre}"`,
        p?.precio || 0,
        p?.stock_total || 0,
        ...sucursalesUnicas.map((nombre) => stockPorSucursal[nombre] || 0),
        p?.activo ? 'activo' : 'inactivo',
      ].join(',');
    });

    const csv = [headers, ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cargarSucursalesModal = async () => {
    try {
      const res = await operacionesService.getSucursales();
      const rows = Array.isArray(res?.sucursales)
        ? res.sucursales
        : Array.isArray(res)
          ? res
          : [];
      setSucursales(rows);

      const stockInit: Record<string, number> = {};
      rows.forEach((s: any) => {
        const sucursalId = String(s?.id ?? '');
        if (!sucursalId) return;
        stockInit[sucursalId] = 0;
      });
      setStockInicial(stockInit);
    } catch {
      setSucursales([]);
      setStockInicial({});
    }
  };

  const onSeleccionarArchivoCSV = async (file: File | null) => {
    setArchivoCSV(file);
    setResultadoImportacion(null);
    setErrorImportacion('');
    if (!file) {
      setPreviewCSV([]);
      setTotalCSV(0);
      return;
    }

    try {
      const text = await file.text();
      procesarCsvPreview(text);
    } catch {
      setPreviewCSV([]);
      setTotalCSV(0);
      setErrorImportacion('No se pudo leer el archivo CSV');
    }
  };

  const abrirModalImportar = () => {
    setModalImportar(true);
    setArchivoCSV(null);
    setPreviewCSV([]);
    setTotalCSV(0);
    setResultadoImportacion(null);
    setErrorImportacion('');
    setProgresoCSV({ actual: 0, total: 0 });
  };

  const cerrarModalImportar = () => {
    if (importandoCSV) return;
    setModalImportar(false);
  };

  const importarProductosCSV = async () => {
    if (!archivoCSV) {
      setErrorImportacion('Selecciona un archivo CSV');
      return;
    }

    setImportandoCSV(true);
    setErrorImportacion('');
    setResultadoImportacion(null);

    const total = totalCSV > 0 ? totalCSV : 1;
    setProgresoCSV({ actual: 0, total });
    const timer = setInterval(() => {
      setProgresoCSV((prev) => ({
        total: prev.total,
        actual: Math.min(prev.actual + 1, Math.max(prev.total - 1, 0)),
      }));
    }, 150);

    try {
      const res = await operacionesService.importarProductosCSV(archivoCSV);
      clearInterval(timer);
      setProgresoCSV({ actual: total, total });
      setResultadoImportacion(res);
      await cargarProductos();
    } catch (err: any) {
      clearInterval(timer);
      setErrorImportacion(err?.message || 'Error al importar CSV');
    } finally {
      setImportandoCSV(false);
    }
  };

  const abrirModalNuevo = () => {
    setErrorNuevoProducto('');
    setModoModal('crear');
    setProductoEditandoId(null);
    setNuevoProducto({
      nombre: '',
      sku: '',
      categoria_id: null,
      descripcion: '',
      precio: '',
      stock_minimo: 0,
      activo: true,
    });
    setSucursales([]);
    setStockInicial({});
    void cargarCategoriasModal();
    void cargarSucursalesModal();
    setModalNuevo(true);
  };

  const abrirModalEditar = (producto: any) => {
    setErrorNuevoProducto('');
    setModoModal('editar');
    setProductoEditandoId(String(producto?.id ?? ''));
    setNuevoProducto({
      nombre: String(producto?.nombre ?? ''),
      sku: String(producto?.sku ?? ''),
      categoria_id: producto?.categoria_id ? String(producto.categoria_id) : null,
      descripcion: String(producto?.descripcion ?? ''),
      precio: String(producto?.precio ?? ''),
      stock_minimo: Number(producto?.stock_minimo ?? 0),
      activo: Boolean(producto?.activo),
    });
    void cargarCategoriasModal();
    setModalNuevo(true);
  };

  const cerrarModalNuevo = () => {
    if (creandoProducto) return;
    setModalNuevo(false);
  };

  const solicitarEliminarProducto = (producto: any) => {
    setConfirmEliminar({
      id: String(producto?.id ?? ''),
      nombre: String(producto?.nombre ?? 'producto'),
    });
  };

  const confirmarEliminarProducto = async () => {
    if (!confirmEliminar?.id) return;
    setEliminandoProducto(true);
    try {
      await operacionesService.eliminarProducto(confirmEliminar.id);
      setProductos((prev) => prev.filter((p) => String(p?.id ?? '') !== confirmEliminar.id));
      if (expandido === confirmEliminar.id) setExpandido(null);
      setConfirmEliminar(null);
    } catch (err) {
      console.error('Error al eliminar producto:', err);
    } finally {
      setEliminandoProducto(false);
    }
  };

  const abrirModalNuevaCategoria = () => {
    setCategoriaEditando(null);
    setNombreCategoria('');
    setDescripcionCategoria('');
    setActivaCategoria(true);
    setErrorCategoria('');
    setModalCategoria(true);
  };

  const abrirModalEditarCategoria = (cat: any) => {
    setCategoriaEditando(cat);
    setNombreCategoria(String(cat?.nombre ?? ''));
    setDescripcionCategoria(String(cat?.descripcion ?? ''));
    setActivaCategoria(Boolean(cat?.activa ?? cat?.activo ?? true));
    setErrorCategoria('');
    setModalCategoria(true);
  };

  const cerrarModalCategoria = () => {
    if (guardandoCategoria) return;
    setModalCategoria(false);
  };

  const guardarCategoria = async (e: any) => {
    e.preventDefault();
    const nombre = String(nombreCategoria ?? '').trim();
    const descripcion = String(descripcionCategoria ?? '').trim();

    if (!nombre) {
      setErrorCategoria('El nombre es obligatorio');
      return;
    }

    setGuardandoCategoria(true);
    setErrorCategoria('');
    try {
      const payload = {
        nombre,
        descripcion: descripcion || null,
        activa: Boolean(activaCategoria),
      };

      if (categoriaEditando?.id) {
        await operacionesService.actualizarCategoria(String(categoriaEditando.id), payload);
      } else {
        await operacionesService.crearCategoria(payload);
      }

      setModalCategoria(false);
      await Promise.all([cargarCategoriasGestion(), cargarCategoriasModal()]);
    } catch (err: any) {
      setErrorCategoria(err?.message || 'Error al guardar categoria');
    } finally {
      setGuardandoCategoria(false);
    }
  };

  const eliminarCategoria = async (categoriaId: string) => {
    if (!categoriaId) return;
    const confirmar = window.confirm('Eliminar esta categoria? Esta accion no se puede deshacer.');
    if (!confirmar) return;

    setEliminandoCategoriaId(categoriaId);
    try {
      await operacionesService.eliminarCategoria(categoriaId);
      await Promise.all([cargarCategoriasGestion(), cargarCategoriasModal()]);
    } catch (err) {
      console.error('Error al eliminar categoria:', err);
    } finally {
      setEliminandoCategoriaId(null);
    }
  };

  const submitNuevoProducto = async (e: any) => {
    e.preventDefault();
    const nombre = String(nuevoProducto.nombre ?? '').trim();
    const sku = String(nuevoProducto.sku ?? '').trim();
    const descripcion = String(nuevoProducto.descripcion ?? '').trim();
    const precioText = String(nuevoProducto.precio ?? '').trim();
    const precio = Number(precioText);
    const stockMinimo = Number(nuevoProducto.stock_minimo ?? 0);

    if (!nombre || !sku || !precioText) {
      setErrorNuevoProducto('Nombre, SKU y precio son obligatorios');
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      setErrorNuevoProducto('El precio debe ser un numero valido');
      return;
    }

    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
      setErrorNuevoProducto('El stock minimo debe ser un numero valido mayor o igual a 0');
      return;
    }

    setCreandoProducto(true);
    setErrorNuevoProducto('');
    try {
      const payload = {
        nombre,
        sku,
        categoria_id: nuevoProducto.categoria_id || null,
        descripcion: descripcion || null,
        precio,
        stock_minimo: stockMinimo,
        activo: Boolean(nuevoProducto.activo),
      };

      if (modoModal === 'editar' && productoEditandoId) {
        await operacionesService.editarProducto(productoEditandoId, payload);
      } else {
        const stockPorSucursal = Object.entries(stockInicial)
          .map(([sucursal_id, cantidad]) => ({ sucursal_id, cantidad: Number(cantidad || 0) }))
          .filter((s) => s.cantidad > 0);

        await operacionesService.crearProducto({
          ...payload,
          stock_por_sucursal: stockPorSucursal,
        } as any);

        try {
          await operacionesService.forzarSyncWooCommerce();
        } catch (syncError) {
          console.error('No se pudo forzar sincronizacion WooCommerce:', syncError);
        }
      }
      setModalNuevo(false);
      await cargarProductos();
    } catch (err: any) {
      setErrorNuevoProducto(
        err?.message || (modoModal === 'editar' ? 'Error al editar producto' : 'Error al crear producto'),
      );
    } finally {
      setCreandoProducto(false);
    }
  };

  return (
    <div className="fade" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 20, color: T.text }}>
            {pestanaActiva === 'productos' ? 'Productos' : 'Categorias'}
          </div>
          <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontMono }}>
            {pestanaActiva === 'productos'
              ? `${productos.length} productos registrados`
              : `${categoriasList.length} categorias registradas`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['productos', 'categorias'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPestanaActiva(tab)}
                style={{
                  background: pestanaActiva === tab ? '#00e87b18' : 'transparent',
                  color: pestanaActiva === tab ? '#00e87b' : '#4d6b58',
                  border: pestanaActiva === tab ? '1px solid #00e87b33' : '1px solid transparent',
                  borderRadius: 8,
                  padding: '6px 16px',
                  fontSize: 12,
                  fontFamily: 'DM Sans',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'productos' ? 'Productos' : 'Categorias'}
              </button>
            ))}
          </div>
          {pestanaActiva === 'productos' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                onClick={exportarProductosCSV}
                style={{
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 700,
                }}
              >
                Exportar CSV
              </button>
              <button
                className="btn"
                onClick={abrirModalImportar}
                style={{
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 700,
                }}
              >
                Importar CSV
              </button>
              <button
                className="btn"
                onClick={abrirModalNuevo}
                style={{
                  background: T.accentDim,
                  border: `1px solid ${T.accent}44`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: T.accent,
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ico d={IC.plus} size={14} color={T.accent} />
                Nuevo Producto
              </button>
            </div>
          )}
        </div>
      </div>

      {pestanaActiva === 'productos' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '8px 12px', flex: 1,
            }}>
              <Ico d={IC.search} size={13} color={T.textMid} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  width: '100%',
                }}
              />
            </div>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{
                background: T.surface2,
                border: `1px solid ${T.border2}`,
                borderRadius: 8,
                padding: '8px 12px',
                color: filtroCategoria === 'todas' ? T.textMid : T.text,
                fontSize: 12,
                fontFamily: T.font,
                cursor: 'pointer',
                minWidth: 160,
              }}
            >
              <option value="todas">Todas las categorias</option>
              <option value="sin_categoria">Sin categoria</option>
              {categorias.map((c: any) => (
                <option key={String(c?.id ?? '')} value={String(c?.id ?? '')}>
                  {String(c?.nombre ?? '')}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 200, color: T.textMid, fontSize: 13,
            }}>
              Cargando productos...
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 40, color: T.textMid, fontSize: 13,
            }}>
              {busqueda ? `No se encontraron productos con "${busqueda}"` : 'No hay productos registrados'}
            </div>
          ) : (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    <th
                      style={{
                        padding: '9px 8px',
                        width: 24,
                        textAlign: 'center',
                        fontSize: 9,
                        color: T.textDim,
                        fontWeight: 700,
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                        fontFamily: T.fontMono,
                      }}
                    />
                    {['SKU', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Woo', 'Estado', 'Acciones'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 16px',
                          textAlign: h === 'Precio' || h === 'Stock' ? 'right' : 'left',
                          fontSize: 9,
                          color: T.textDim,
                          fontWeight: 700,
                          letterSpacing: '0.09em',
                          textTransform: 'uppercase',
                          fontFamily: T.fontMono,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => {
                    const productoId = String(p?.id ?? '');
                    const abierto = expandido === productoId;
                    const stockTotal = Number(p?.stock_total || 0);
                    const stockPorSucursal = Array.isArray(p?.stock_por_sucursal) ? p.stock_por_sucursal : [];
                    const estaActivo = Boolean(p?.activo);

                    return (
                      <Fragment key={productoId}>
                        <tr
                          className="tr"
                          style={{ borderBottom: `1px solid ${T.border}` }}
                        >
                          <td
                            onClick={() => setExpandido(abierto ? null : productoId)}
                            style={{
                              padding: '12px 8px',
                              cursor: 'pointer',
                              width: 24,
                              textAlign: 'center',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path
                                d="M2 3.5L5 6.5L8 3.5"
                                stroke={T.textMid}
                                strokeWidth="1.5"
                                style={{
                                  transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                  display: 'block',
                                }}
                              />
                            </svg>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: T.fontMono, color: T.accent, fontSize: 12 }}>
                            {p?.sku || 'ï¿½'}
                          </td>
                          <td style={{ padding: '12px 16px', color: T.text, fontWeight: 500 }}>
                            {p?.nombre || 'Producto sin nombre'}
                          </td>
                          <td style={{ padding: '12px 16px', color: T.textMid, fontSize: 12 }}>
                            {categorias.find((c: any) => String(c?.id ?? '') === String(p?.categoria_id ?? ''))?.nombre || (
                              <span style={{ color: T.textDim, fontStyle: 'italic', fontSize: 11 }}>
                                Sin categoría
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', color: T.textMid, textAlign: 'right' }}>
                            S/ {Number(p?.precio || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span
                              style={{
                                color: stockTotal > 10 ? T.accent : stockTotal > 0 ? '#f59e0b' : '#ef4444',
                                fontWeight: 700,
                                fontFamily: T.fontMono,
                              }}
                            >
                              {stockTotal}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {p?.woo_sincronizado ? (
                              <span
                                style={{
                                  background: T.accentDim,
                                  color: T.accent,
                                  borderRadius: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                }}
                              >
                                sync
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: `${T.textMid}18`,
                                  color: T.textMid,
                                  borderRadius: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                }}
                              >
                                ï¿½
                              </span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()} style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => toggleActivo(productoId, estaActivo)}
                              style={{
                                background: estaActivo ? T.accentDim : '#ef444418',
                                color: estaActivo ? T.accent : '#ef4444',
                                border: 'none',
                                borderRadius: 4,
                                padding: '2px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              {estaActivo ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td onClick={(e) => e.stopPropagation()} style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalEditar(p);
                                }}
                                style={{
                                  background: T.accentDim,
                                  color: T.accent,
                                  border: `1px solid ${T.accent}33`,
                                  borderRadius: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                Editar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  solicitarEliminarProducto(p);
                                }}
                                style={{
                                  background: '#ef444418',
                                  color: '#ef4444',
                                  border: '1px solid #ef444433',
                                  borderRadius: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        {abierto && (
                          <tr>
                            <td
                              colSpan={9}
                              style={{
                                background: T.surface,
                                padding: '12px 16px',
                                borderBottom: `1px solid ${T.border}`,
                              }}
                            >
                              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 8 }}>
                                Stock por sucursal
                              </div>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {stockPorSucursal.map((s: any, idx: number) => (
                                  <div
                                    key={String(s?.sucursal_id ?? idx)}
                                    style={{
                                      background: T.surface2,
                                      border: `1px solid ${T.border2}`,
                                      borderRadius: 8,
                                      padding: '8px 16px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                    }}
                                  >
                                    <span style={{ color: T.textMid, fontSize: 11 }}>
                                      {s?.sucursal_nombre || 'Sucursal'}
                                    </span>
                                    <span
                                      style={{
                                        color: T.text,
                                        fontFamily: T.fontMono,
                                        fontSize: 18,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {Number(s?.cantidad || 0)}
                                    </span>
                                  </div>
                                ))}
                                {stockPorSucursal.length === 0 && (
                                  <span style={{ color: T.textMid, fontSize: 12 }}>
                                    Sin stock en sucursales
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, color: T.text, fontFamily: T.fontDisplay }}>Categorias</h2>
              <p style={{ margin: '4px 0 0 0', color: T.textMid, fontSize: 12 }}>
                {categoriasList.length} categorias registradas
              </p>
            </div>
            <button
              className="btn"
              onClick={abrirModalNuevaCategoria}
              style={{
                background: T.accentDim,
                border: `1px solid ${T.accent}44`,
                borderRadius: 8,
                padding: '8px 14px',
                color: T.accent,
                fontSize: 12,
                fontFamily: T.font,
                fontWeight: 700,
              }}
            >
              + Nueva Categoria
            </button>
          </div>
          {loadingCats ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 180, color: T.textMid, fontSize: 13,
            }}>
              Cargando categorias...
            </div>
          ) : categoriasList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMid, fontSize: 13 }}>
              No hay categorias registradas
            </div>
          ) : (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {['Nombre', 'Descripcion', 'Estado', 'Acciones'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 16px',
                          textAlign: 'left',
                          fontSize: 9,
                          color: T.textDim,
                          fontWeight: 700,
                          letterSpacing: '0.09em',
                          textTransform: 'uppercase',
                          fontFamily: T.fontMono,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoriasList.map((cat) => (
                    <tr key={String(cat?.id ?? '')} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '12px 16px', color: T.text, fontWeight: 600 }}>
                        {String(cat?.nombre ?? '')}
                      </td>
                      <td style={{ padding: '12px 16px', color: T.textMid }}>
                        {cat?.descripcion || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: cat?.activa ? '#00e87b' : '#ef4444', fontWeight: 700 }}>
                          {cat?.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn"
                            onClick={() => abrirModalEditarCategoria(cat)}
                            style={{
                              background: T.accentDim,
                              color: T.accent,
                              border: `1px solid ${T.accent}33`,
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="btn"
                            onClick={() => eliminarCategoria(String(cat?.id ?? ''))}
                            disabled={eliminandoCategoriaId === String(cat?.id ?? '')}
                            style={{
                              background: '#ef444418',
                              color: '#ef4444',
                              border: '1px solid #ef444433',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                              opacity: eliminandoCategoriaId === String(cat?.id ?? '') ? 0.6 : 1,
                            }}
                          >
                            {eliminandoCategoriaId === String(cat?.id ?? '') ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
      {modalNuevo && (
        <div
          onClick={cerrarModalNuevo}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18, color: T.text }}>
                  {modoModal === 'editar' ? 'Editar Producto' : 'Nuevo Producto'}
                </div>
                <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontMono }}>
                  {modoModal === 'editar' ? 'Actualiza los datos del producto' : 'Crea un producto para tu catalogo'}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={cerrarModalNuevo}
                disabled={creandoProducto}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  color: T.textMid,
                  fontSize: 16,
                }}
              >
                X
              </button>
            </div>

            <form onSubmit={submitNuevoProducto}>
              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Nombre del producto
              </label>
              <input
                value={nuevoProducto.nombre}
                onChange={(e) => setNuevoProducto((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Creatina 300g ON"
                disabled={creandoProducto}
                maxLength={160}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  marginBottom: 12,
                }}
              />

              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                SKU
              </label>
              <input
                value={nuevoProducto.sku}
                onChange={(e) => setNuevoProducto((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="Ej. CREA-300G-ON"
                disabled={creandoProducto}
                maxLength={120}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.fontMono,
                  marginBottom: 12,
                }}
              />

              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Categoria (opcional)
              </label>
              <select
                value={nuevoProducto.categoria_id || ''}
                onChange={(e) =>
                  setNuevoProducto((prev) => ({
                    ...prev,
                    categoria_id: e.target.value || null,
                  }))
                }
                disabled={creandoProducto || cargandoCategorias}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  marginBottom: 6,
                }}
              >
                <option value="">Sin categoria</option>
                {categorias.map((c: any) => (
                  <option key={String(c?.id ?? '')} value={String(c?.id ?? '')}>
                    {String(c?.nombre ?? 'Categoria')}
                  </option>
                ))}
              </select>
              {cargandoCategorias && (
                <div style={{ fontSize: 10, color: T.textMid, marginBottom: 12 }}>
                  Cargando categorias...
                </div>
              )}
              {!cargandoCategorias && categorias.length === 0 && (
                <div style={{ fontSize: 10, color: T.textMid, marginBottom: 12 }}>
                  No hay categorias activas, se guardara sin categoria.
                </div>
              )}

              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Descripcion (opcional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={nuevoProducto.descripcion}
                onChange={(e) =>
                  setNuevoProducto((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                placeholder="Descripcion del producto (opcional)"
                disabled={creandoProducto}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  resize: 'vertical',
                  marginBottom: 12,
                }}
              />

              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Precio
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={nuevoProducto.precio}
                onChange={(e) => setNuevoProducto((prev) => ({ ...prev, precio: e.target.value }))}
                placeholder="0.00"
                disabled={creandoProducto}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.fontMono,
                  marginBottom: 12,
                }}
              />

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: T.textMid, marginBottom: 6, display: 'block' }}>
                  Stock minimo por sucursal
                </label>
                <input
                  type="number"
                  min="0"
                  value={nuevoProducto.stock_minimo || 0}
                  onChange={(e) => setNuevoProducto((prev) => ({
                    ...prev,
                    stock_minimo: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))}
                  placeholder="0"
                  style={{
                    width: '100%',
                    background: T.bg,
                    border: `1px solid ${T.border2}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: T.text,
                    fontSize: 13,
                    fontFamily: T.fontMono,
                  }}
                />
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
                  Alerta cuando el stock baje de este numero en cualquier sucursal
                </div>
              </div>

              {modoModal === 'crear' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: T.textMid, marginBottom: 8, display: 'block' }}>
                    Stock inicial por sucursal
                  </label>
                  {sucursales.map((s: any) => {
                    const sucursalId = String(s?.id ?? '');
                    if (!sucursalId) return null;

                    return (
                      <div
                        key={sucursalId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: T.surface2,
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 12, color: T.text }}>{String(s?.nombre ?? 'Sucursal')}</span>
                        <input
                          type="number"
                          min="0"
                          disabled={creandoProducto}
                          value={stockInicial[sucursalId] || 0}
                          onChange={(e) =>
                            setStockInicial((prev) => ({
                              ...prev,
                              [sucursalId]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          style={{
                            width: 80,
                            background: T.bg,
                            border: `1px solid ${T.border2}`,
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: T.text,
                            fontSize: 13,
                            textAlign: 'right',
                            fontFamily: T.fontMono,
                          }}
                        />
                      </div>
                    );
                  })}
                  {sucursales.length === 0 && (
                    <div style={{ fontSize: 11, color: T.textMid }}>
                      No hay sucursales disponibles.
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, color: T.text }}>Activo</span>
                <button
                  type="button"
                  onClick={() =>
                    setNuevoProducto((prev) => ({ ...prev, activo: !prev.activo }))
                  }
                  disabled={creandoProducto}
                  style={{
                    background: nuevoProducto.activo ? T.accentDim : '#ef444418',
                    color: nuevoProducto.activo ? T.accent : '#ef4444',
                    border: 'none',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {nuevoProducto.activo ? 'SI' : 'NO'}
                </button>
              </div>

              {errorNuevoProducto && (
                <div
                  style={{
                    marginBottom: 12,
                    background: '#2a0d10',
                    border: '1px solid #5a1a20',
                    color: '#ff9aa5',
                    borderRadius: 8,
                    padding: '9px 10px',
                    fontSize: 11,
                    fontFamily: T.font,
                  }}
                >
                  {errorNuevoProducto}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={cerrarModalNuevo}
                  disabled={creandoProducto}
                  style={{
                    background: T.surface2,
                    border: `1px solid ${T.border2}`,
                    borderRadius: 8,
                    padding: '9px 14px',
                    color: T.textMid,
                    fontSize: 12,
                    fontFamily: T.font,
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={creandoProducto}
                  style={{
                    background: T.accentDim,
                    border: `1px solid ${T.accent}44`,
                    borderRadius: 8,
                    padding: '9px 14px',
                    color: T.accent,
                    fontSize: 12,
                    fontFamily: T.font,
                    fontWeight: 700,
                  }}
                >
                  {creandoProducto ? (modoModal === 'editar' ? 'Guardando...' : 'Creando...') : (modoModal === 'editar' ? 'Guardar cambios' : 'Crear Producto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalCategoria && (
        <div
          onClick={cerrarModalCategoria}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1440,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18, color: T.text }}>
                  {categoriaEditando ? 'Editar Categoria' : 'Nueva Categoria'}
                </div>
                <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontMono }}>
                  {categoriaEditando ? 'Actualiza la categoria seleccionada' : 'Crea una nueva categoria de productos'}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={cerrarModalCategoria}
                disabled={guardandoCategoria}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  color: T.textMid,
                  fontSize: 16,
                }}
              >
                X
              </button>
            </div>

            <form onSubmit={guardarCategoria}>
              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Nombre
              </label>
              <input
                value={nombreCategoria}
                onChange={(e) => setNombreCategoria(e.target.value)}
                placeholder="Ej. Suplementos"
                maxLength={120}
                disabled={guardandoCategoria}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  marginBottom: 12,
                }}
              />

              <label style={{ display: 'block', fontSize: 11, color: T.textMid, marginBottom: 6 }}>
                Descripcion (opcional)
              </label>
              <textarea
                rows={3}
                value={descripcionCategoria}
                onChange={(e) => setDescripcionCategoria(e.target.value)}
                placeholder="Describe brevemente la categoria"
                disabled={guardandoCategoria}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  resize: 'vertical',
                  marginBottom: 12,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, color: T.text }}>Activa</span>
                <button
                  type="button"
                  onClick={() => setActivaCategoria((prev) => !prev)}
                  disabled={guardandoCategoria}
                  style={{
                    background: activaCategoria ? T.accentDim : '#ef444418',
                    color: activaCategoria ? T.accent : '#ef4444',
                    border: 'none',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {activaCategoria ? 'SI' : 'NO'}
                </button>
              </div>

              {errorCategoria && (
                <div
                  style={{
                    marginBottom: 12,
                    background: '#2a0d10',
                    border: '1px solid #5a1a20',
                    color: '#ff9aa5',
                    borderRadius: 8,
                    padding: '9px 10px',
                    fontSize: 11,
                    fontFamily: T.font,
                  }}
                >
                  {errorCategoria}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={cerrarModalCategoria}
                  disabled={guardandoCategoria}
                  style={{
                    background: T.surface2,
                    border: `1px solid ${T.border2}`,
                    borderRadius: 8,
                    padding: '9px 14px',
                    color: T.textMid,
                    fontSize: 12,
                    fontFamily: T.font,
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={guardandoCategoria}
                  style={{
                    background: T.accentDim,
                    border: `1px solid ${T.accent}44`,
                    borderRadius: 8,
                    padding: '9px 14px',
                    color: T.accent,
                    fontSize: 12,
                    fontFamily: T.font,
                    fontWeight: 700,
                  }}
                >
                  {guardandoCategoria ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmEliminar && (
        <div
          onClick={() => {
            if (!eliminandoProducto) setConfirmEliminar(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1450,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
              padding: 18,
            }}
          >
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 8 }}>
              Eliminar producto
            </div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 16 }}>
              {`ï¿½Eliminar ${confirmEliminar.nombre}? Esta acciï¿½n no se puede deshacer.`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmEliminar(null)}
                disabled={eliminandoProducto}
                style={{
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '9px 14px',
                  color: T.textMid,
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmarEliminarProducto}
                disabled={eliminandoProducto}
                style={{
                  background: '#ef444418',
                  border: '1px solid #ef444433',
                  borderRadius: 8,
                  padding: '9px 14px',
                  color: '#ef4444',
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 700,
                }}
              >
                {eliminandoProducto ? 'Eliminando...' : 'Si, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalImportar && (
        <div
          onClick={cerrarModalImportar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1460,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 640,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18, color: T.text }}>
                  Importar Productos CSV
                </div>
                <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontMono }}>
                  Importa productos masivamente desde un archivo CSV
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={cerrarModalImportar}
                disabled={importandoCSV}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  color: T.textMid,
                  fontSize: 16,
                }}
              >
                X
              </button>
            </div>

            <div style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.text, marginBottom: 8, fontWeight: 700 }}>
                Subir archivo
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importandoCSV}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void onSeleccionarArchivoCSV(file);
                }}
                style={{
                  width: '100%',
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '9px 10px',
                  color: T.text,
                  fontSize: 12,
                  fontFamily: T.font,
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 11, color: T.textMid, marginBottom: 8 }}>
                {`${totalCSV} productos encontrados en el archivo`}
              </div>
              {previewCSV.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: T.bg }}>
                        {['nombre', 'sku', 'precio', 'costo', 'descripcion', 'stock_minimo'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '7px 8px',
                              textAlign: 'left',
                              fontSize: 9,
                              color: T.textDim,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              fontFamily: T.fontMono,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewCSV.map((row, idx) => (
                        <tr key={idx} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.text }}>{row.nombre || 'ï¿½'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.accent, fontFamily: T.fontMono }}>{row.sku || 'ï¿½'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.textMid }}>{row.precio || 'ï¿½'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.textMid }}>{row.costo || 'ï¿½'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.textMid }}>{row.descripcion || 'ï¿½'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 11, color: T.textMid }}>{row.stock_minimo || 'ï¿½'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: T.textMid }}>
                {importandoCSV ? `Importando... ${progresoCSV.actual}/${progresoCSV.total} productos` : ''}
              </div>
              <button
                type="button"
                className="btn"
                onClick={importarProductosCSV}
                disabled={!archivoCSV || importandoCSV}
                style={{
                  background: T.accentDim,
                  border: `1px solid ${T.accent}44`,
                  borderRadius: 8,
                  padding: '9px 14px',
                  color: T.accent,
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 700,
                }}
              >
                {importandoCSV ? 'Importando...' : 'Importar'}
              </button>
            </div>

            {errorImportacion && (
              <div style={{ marginTop: 12, background: '#2a0d10', border: '1px solid #5a1a20', color: '#ff9aa5', borderRadius: 8, padding: '9px 10px', fontSize: 11 }}>
                {errorImportacion}
              </div>
            )}

            {resultadoImportacion && (
              <div style={{ marginTop: 12, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginBottom: 6 }}>
                  {`Exitosos: ${Number(resultadoImportacion?.exitosos || 0)} productos importados`}
                </div>
                <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>
                  {`Con errores: ${Number(resultadoImportacion?.errores || 0)} productos`}
                </div>
                {Array.isArray(resultadoImportacion?.detalle_errores) && resultadoImportacion.detalle_errores.length > 0 && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                    {resultadoImportacion.detalle_errores.map((err: any, idx: number) => (
                      <div key={idx} style={{ fontSize: 11, color: '#ff9aa5', marginBottom: 4 }}>
                        {`Fila ${err?.fila ?? '-'} (${err?.sku ?? 'sin-sku'}): ${err?.error ?? 'Error'}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewProductos;

