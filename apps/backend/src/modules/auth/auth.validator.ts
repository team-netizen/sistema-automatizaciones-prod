import { BadRequestException } from '@nestjs/common';
import type { LoginDto } from './auth.types';

/**
 * Validador del módulo de autenticación.
 * Valida inputs ANTES de tocar Supabase (fail-fast).
 */
export class AuthValidator {
    static validateLogin(dto: LoginDto): void {
        if (!dto.email || typeof dto.email !== 'string') {
            throw new BadRequestException('El campo "email" es obligatorio');
        }

        // Validación básica de formato email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(dto.email)) {
            throw new BadRequestException('El formato del email no es válido');
        }

        if (!dto.password || typeof dto.password !== 'string') {
            throw new BadRequestException('El campo "password" es obligatorio');
        }

        if (dto.password.length < 6) {
            throw new BadRequestException(
                'La contraseña debe tener al menos 6 caracteres',
            );
        }
    }
}
