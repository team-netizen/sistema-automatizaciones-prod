/**
 * Calcula la distancia entre dos puntos geográficos utilizando la fórmula de Haversine.
 * 
 * @param lat1 Latitud del punto 1
 * @param lon1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lon2 Longitud del punto 2
 * @returns Distancia en kilómetros (km)
 * @throws Error si alguna de las coordenadas es nula o indefinida.
 */
export function calcularDistanciaHaversine(
    lat1: number | null | undefined,
    lon1: number | null | undefined,
    lat2: number | null | undefined,
    lon2: number | null | undefined,
): number {
    // 1. Validar valores nulos o indefinidos
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
        throw new Error(
            `Coordenadas inválidas para el cálculo de distancia. Recibido: P1(${lat1}, ${lon1}), P2(${lat2}, ${lon2})`
        );
    }

    // 2. Radio de la Tierra en kilómetros
    const R = 6371;

    // 3. Convertir grados a radianes
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    // 4. Aplicar fórmula de Haversine
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // 5. Retornar distancia final
    return R * c;
}

/**
 * Convierte grados a radianes.
 */
function toRad(value: number): number {
    return (value * Math.PI) / 180;
}
