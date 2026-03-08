import { API_URL, authFetch } from '../../../lib/api';

type PrimitiveValue = string | number | boolean | null | undefined;
type QueryFilters = Record<string, PrimitiveValue>;

function buildQueryString(filters?: QueryFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function parseOrThrow(response: Response, errorMessage: string) {
  if (!response.ok) throw new Error(errorMessage);
  return response.json();
}

export const operacionesService = {
  getDashboardMetrics: async () => {
    const response = await authFetch(`${API_URL}/operaciones/dashboard`);
    return parseOrThrow(response, 'Error al obtener metricas del dashboard');
  },

  getResumenTurnoVendedor: async (filters: {
    sucursalId: string;
    empresaId: string;
    vendedorId: string;
  }) => {
    const response = await authFetch(
      `${API_URL}/operaciones/vendedor/resumen-turno${buildQueryString(filters as QueryFilters)}`,
    );
    return parseOrThrow(response, 'Error al obtener resumen del turno');
  },

  crearPedidoVendedor: async (data: {
    empresaId: string;
    sucursalId: string;
    vendedorId: string;
    items: { productoId: string; cantidad: number; precioUnitario: number }[];
    cliente: { nombre?: string; telefono?: string; dni?: string; email?: string };
    metodoPago: 'efectivo' | 'tarjeta' | 'yape_plin' | 'transferencia';
    montoRecibido?: number;
    observaciones?: string;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/vendedor/crear-pedido`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al crear venta');
  },

  getMisVentasVendedor: async (filters: {
    vendedorId: string;
    sucursalId: string;
    empresaId: string;
    desde: string;
    hasta: string;
  }) => {
    const response = await authFetch(
      `${API_URL}/operaciones/vendedor/mis-ventas${buildQueryString(filters as QueryFilters)}`,
    );
    return parseOrThrow(response, 'Error al obtener ventas del vendedor');
  },

  buscarProductosParaVenta: async (filters: {
    q: string;
    sucursalId: string;
    empresaId: string;
  }) => {
    const response = await authFetch(
      `${API_URL}/operaciones/vendedor/buscar-productos${buildQueryString(filters as QueryFilters)}`,
    );
    return parseOrThrow(response, 'Error al buscar productos');
  },

  getProductosCriticos: async () => {
    const response = await authFetch(`${API_URL}/operaciones/productos/criticos`);
    return parseOrThrow(response, 'Error al obtener productos criticos');
  },

  getProductos: async (filters?: QueryFilters) => {
    const response = await authFetch(`${API_URL}/operaciones/productos${buildQueryString(filters)}`);
    return parseOrThrow(response, 'Error al obtener productos');
  },

  getCategorias: async (filters?: { incluir_inactivas?: boolean; solo_activas?: boolean }) => {
    const response = await authFetch(
      `${API_URL}/operaciones/categorias${buildQueryString(filters as QueryFilters)}`,
    );
    if (!response.ok) return { categorias: [] };
    return response.json();
  },

  crearCategoria: async (data: { nombre: string; descripcion?: string; activa: boolean }) => {
    const response = await authFetch(`${API_URL}/operaciones/categorias`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al crear categoria');
    return response.json();
  },

  actualizarCategoria: async (id: string, data: any) => {
    const response = await authFetch(`${API_URL}/operaciones/categorias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al actualizar categoria');
    return response.json();
  },

  eliminarCategoria: async (id: string) => {
    const response = await authFetch(`${API_URL}/operaciones/categorias/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error al eliminar categoria');
    return response.json();
  },

  importarProductosCSV: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch(`${API_URL}/operaciones/productos/importar`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let message = 'Error al importar CSV';
      try {
        const error = (await response.json()) as { message?: string };
        if (error?.message) message = error.message;
      } catch {
        // noop
      }
      throw new Error(message);
    }

    return response.json();
  },

  crearProducto: async (data: {
    nombre: string;
    sku: string;
    precio: number;
    activo: boolean;
    categoria_id?: string | null;
    descripcion?: string | null;
    stock_por_sucursal?: Array<{ sucursal_id: string; cantidad: number }>;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/productos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let message = 'Error al crear producto';
      try {
        const error = (await response.json()) as { message?: string };
        if (error?.message) message = error.message;
      } catch {
        // noop
      }
      throw new Error(message);
    }
    return response.json();
  },

  editarProducto: async (id: string, data: any) => {
    const response = await authFetch(`${API_URL}/operaciones/productos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let message = 'Error al editar producto';
      try {
        const error = (await response.json()) as { message?: string };
        if (error?.message) message = error.message;
      } catch {
        // noop
      }
      throw new Error(message);
    }
    return response.json();
  },

  eliminarProducto: async (id: string) => {
    const response = await authFetch(`${API_URL}/operaciones/productos/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error al eliminar producto');
    return response.json();
  },

  toggleProductoActivo: async (productoId: string, activo: boolean) => {
    const response = await authFetch(`${API_URL}/operaciones/productos/${productoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    });
    if (!response.ok) throw new Error('Error al actualizar producto');
    return response.json();
  },

  getMovimientos: async (filters?: QueryFilters) => {
    const response = await authFetch(`${API_URL}/operaciones/movimientos${buildQueryString(filters)}`);
    return parseOrThrow(response, 'Error al obtener movimientos');
  },

  getPedidos: async () => {
    const response = await authFetch(`${API_URL}/operaciones/pedidos`);
    return parseOrThrow(response, 'Error al obtener pedidos');
  },

  getAlertas: async (filters?: { limit?: number; solo_no_leidas?: boolean }) => {
    const response = await authFetch(
      `${API_URL}/operaciones/alertas${buildQueryString(filters as QueryFilters)}`,
    );
    return parseOrThrow(response, 'Error al obtener alertas');
  },

  marcarAlertaLeida: async (id: string) => {
    const response = await authFetch(`${API_URL}/operaciones/alertas/${id}/leer`, {
      method: 'PATCH',
    });
    return parseOrThrow(response, 'Error al marcar alerta');
  },

  marcarTodasAlertasLeidas: async () => {
    const response = await authFetch(`${API_URL}/operaciones/alertas/leer-todas`, {
      method: 'PATCH',
    });
    return parseOrThrow(response, 'Error al marcar alertas');
  },

  verificarStockBajo: async () => {
    const response = await authFetch(`${API_URL}/operaciones/alertas/verificar-stock`, {
      method: 'POST',
    });
    return parseOrThrow(response, 'Error al verificar stock');
  },

  getReportes: async () => {
    const response = await authFetch(`${API_URL}/operaciones/reportes`);
    return parseOrThrow(response, 'Error al obtener reportes');
  },

  getReporteVentas: async (inicio: string, fin: string) => {
    const response = await authFetch(
      `${API_URL}/operaciones/reportes/ventas?inicio=${inicio}&fin=${fin}`,
    );
    return parseOrThrow(response, 'Error al obtener reporte ventas');
  },

  getReporteProductos: async (inicio: string, fin: string) => {
    const response = await authFetch(
      `${API_URL}/operaciones/reportes/productos?inicio=${inicio}&fin=${fin}`,
    );
    return parseOrThrow(response, 'Error al obtener reporte productos');
  },

  getReporteCanales: async (inicio: string, fin: string) => {
    const response = await authFetch(
      `${API_URL}/operaciones/reportes/canales?inicio=${inicio}&fin=${fin}`,
    );
    return parseOrThrow(response, 'Error al obtener reporte canales');
  },

  getSucursales: async () => {
    const response = await authFetch(`${API_URL}/operaciones/sucursales`);
    return parseOrThrow(response, 'Error al obtener sucursales');
  },

  crearSucursal: async (data: {
    nombre: string;
    tipo?: string;
    estado?: string;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/sucursales`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al crear sucursal');
  },

  // Obtener transferencias
  getTransferencias: async (filtros?: { estado?: string; sucursal_id?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.sucursal_id) params.set('sucursal_id', filtros.sucursal_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await authFetch(`${API_URL}/operaciones/transferencias${query}`);
    if (!response.ok) throw new Error('Error al obtener transferencias');
    return response.json();
  },

  getStockPorSucursal: async (sucursal_id?: string) => {
    const response = await authFetch(
      `${API_URL}/operaciones/stock${buildQueryString({ sucursal_id })}`,
    );
    return parseOrThrow(response, 'Error al obtener stock por sucursal');
  },

  ajustarStock: async (data: {
    producto_id: string;
    sucursal_id: string;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    motivo: string;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/stock/ajuste`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al ajustar stock');
    }
    return response.json();
  },

  getIntegraciones: async () => {
    const response = await authFetch(`${API_URL}/operaciones/integraciones`);
    return parseOrThrow(response, 'Error al obtener integraciones');
  },

  getUsuarios: async () => {
    const response = await authFetch(`${API_URL}/operaciones/usuarios`);
    return parseOrThrow(response, 'Error al obtener usuarios');
  },

  crearUsuario: async (data: {
    email: string;
    password: string;
    rol: string;
    sucursal_id: string | null;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/usuarios`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al crear usuario');
  },

  editarUsuario: async (
    id: string,
    data: {
      rol: string;
      sucursal_id: string | null;
    },
  ) => {
    const response = await authFetch(`${API_URL}/operaciones/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al editar usuario');
  },

  toggleUsuario: async (id: string, activo: boolean) => {
    const response = await authFetch(`${API_URL}/operaciones/usuarios/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    });
    return parseOrThrow(response, 'Error al actualizar usuario');
  },

  resetPasswordUsuario: async (email: string) => {
    const response = await authFetch(`${API_URL}/operaciones/usuarios/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return parseOrThrow(response, 'Error al enviar reset');
  },

  conectarIntegracion: async (data: {
    tipo: string;
    credenciales: Record<string, string>;
    modo: 'conectar' | 'configurar';
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/integraciones/conectar`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al conectar integracion');
  },

  desconectarIntegracion: async (tipo: string) => {
    const response = await authFetch(`${API_URL}/operaciones/integraciones/${tipo}/desconectar`, {
      method: 'POST',
    });
    return parseOrThrow(response, 'Error al desconectar integracion');
  },

  getReservas: async () => {
    const response = await authFetch(`${API_URL}/operaciones/reservas`);
    return parseOrThrow(response, 'Error al obtener reservas');
  },

  // Crear transferencia
  crearTransferencia: async (data: {
    sucursal_origen_id: string;
    sucursal_destino_id: string;
    notas?: string;
    aprobacion_requerida: boolean;
    items: Array<{ producto_id: string; cantidad_enviada: number }>;
  }) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear transferencia');
    }
    return response.json();
  },

  // Aprobar transferencia
  aprobarTransferencia: async (id: string) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias/${id}/aprobar`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al aprobar transferencia');
    }
    return response.json();
  },

  // Rechazar transferencia
  rechazarTransferencia: async (id: string, motivo: string) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al rechazar transferencia');
    }
    return response.json();
  },

  actualizarEstadoTransferencia: async (id: string, estado: string) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    return parseOrThrow(response, 'Error al actualizar estado de transferencia');
  },

  conectarWooCommerce: async (data: {
    url: string;
    consumer_key: string;
    consumer_secret: string;
  }) => {
    const response = await authFetch(`${API_URL}/integraciones/woocommerce/conectar`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let message = 'Error al conectar WooCommerce';
      try {
        const error = (await response.json()) as { message?: string };
        if (error?.message) message = error.message;
      } catch {
        // noop
      }
      throw new Error(message);
    }

    return response.json();
  },

  desconectarWooCommerce: async () => {
    const response = await authFetch(`${API_URL}/integraciones/woocommerce/desconectar`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Error al desconectar');
    return response.json();
  },

  forzarSyncWooCommerce: async () => {
    const response = await authFetch(`${API_URL}/integraciones/woocommerce/sync`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Error al sincronizar');
    return response.json();
  },

  getEstadoWooCommerce: async () => {
    const response = await authFetch(`${API_URL}/integraciones/woocommerce/estado`);
    if (!response.ok) return null;
    return response.json();
  },
};
