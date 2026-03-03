import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios from 'axios';
import googleConfig from '../../config/google.config';

export interface GeocodingResult {
    lat: number;
    lng: number;
}

@Injectable()
export class GoogleGeocodingService {
    private readonly logger = new Logger(GoogleGeocodingService.name);
    private readonly apiKey: string;

    constructor(
        @Inject(googleConfig.KEY)
        private readonly config: ConfigType<typeof googleConfig>,
    ) {
        this.apiKey = this.config.mapsApiKey || '';
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno');
        }
    }

    /**
     * Obtiene las coordenadas (latitud y longitud) a partir de una dirección.
     * @param direccion Calle y número
     * @param distrito Distrito o comuna
     * @param provincia Ciudad o provincia
     * @param pais País
     */
    async obtenerCoordenadas(
        direccion: string,
        distrito: string,
        provincia: string,
        pais: string,
    ): Promise<GeocodingResult | null> {
        try {
            if (!this.apiKey) {
                this.logger.error('No se puede ejecutar geocoding: API Key ausente');
                return null;
            }

            // 1. Construir dirección completa
            const fullAddress = `${direccion}, ${distrito}, ${provincia}, ${pais}`;

            // 2. Ejecutar petición a Google Maps
            const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                    address: fullAddress,
                    key: this.apiKey,
                },
            });

            const { status, results } = response.data;

            // 3. Manejar estados de respuesta
            switch (status) {
                case 'OK':
                    if (results && results.length > 0) {
                        const { lat, lng } = results[0].geometry.location;
                        return { lat, lng };
                    }
                    return null;

                case 'ZERO_RESULTS':
                    this.logger.warn(`No se encontraron resultados para la dirección: ${fullAddress}`);
                    return null;

                case 'OVER_QUERY_LIMIT':
                    this.logger.error('Google API Error: OVER_QUERY_LIMIT. Se ha excedido la cuota.');
                    return null;

                case 'REQUEST_DENIED':
                    this.logger.error(`Google API Error: REQUEST_DENIED. Mensaje: ${response.data.error_message || 'Sin mensaje'}`);
                    return null;

                case 'INVALID_REQUEST':
                    this.logger.error('Google API Error: INVALID_REQUEST. Faltan parámetros.');
                    return null;

                default:
                    this.logger.error(`Google API Error: ${status}. Fallo inesperado.`);
                    return null;
            }
        } catch (error: any) {
            this.logger.error(`Error de conexión con Google Geocoding API: ${error.message}`);
            return null;
        }
    }
}
