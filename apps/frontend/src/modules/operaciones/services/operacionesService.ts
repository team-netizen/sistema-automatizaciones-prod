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

  getProductosCriticos: async () => {
    const response = await authFetch(`${API_URL}/operaciones/productos/criticos`);
    return parseOrThrow(response, 'Error al obtener productos criticos');
  },

  getProductos: async (filters?: QueryFilters) => {
    const response = await authFetch(`${API_URL}/operaciones/productos${buildQueryString(filters)}`);
    return parseOrThrow(response, 'Error al obtener productos');
  },

  getCategorias: async () => {
    const response = await authFetch(`${API_URL}/operaciones/categorias`);
    if (!response.ok) return { categorias: [] };
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

  getAlertas: async () => {
    const response = await authFetch(`${API_URL}/operaciones/alertas`);
    return parseOrThrow(response, 'Error al obtener alertas');
  },

  getReportes: async () => {
    const response = await authFetch(`${API_URL}/operaciones/reportes`);
    return parseOrThrow(response, 'Error al obtener reportes');
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

  getTransferencias: async (filters?: QueryFilters) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias${buildQueryString(filters)}`);
    return parseOrThrow(response, 'Error al obtener transferencias');
  },

  getStockPorSucursal: async (sucursal_id?: string) => {
    const response = await authFetch(
      `${API_URL}/operaciones/stock${buildQueryString({ sucursal_id })}`,
    );
    return parseOrThrow(response, 'Error al obtener stock por sucursal');
  },

  getIntegraciones: async () => {
    const response = await authFetch(`${API_URL}/operaciones/integraciones`);
    return parseOrThrow(response, 'Error al obtener integraciones');
  },

  getReservas: async () => {
    const response = await authFetch(`${API_URL}/operaciones/reservas`);
    return parseOrThrow(response, 'Error al obtener reservas');
  },

  crearTransferencia: async (data: QueryFilters) => {
    const response = await authFetch(`${API_URL}/operaciones/transferencias`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseOrThrow(response, 'Error al crear transferencia');
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
