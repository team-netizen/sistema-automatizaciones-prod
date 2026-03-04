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
};

