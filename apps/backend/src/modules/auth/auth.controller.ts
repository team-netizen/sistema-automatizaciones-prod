import {
    Controller,
    Post,
    Get,
    Body,
    HttpException,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthValidator } from './auth.validator';
import { SupabaseAuthGuard } from '../../core/auth/auth.guard';
import type { LoginDto } from './auth.types';
import { consumeRateLimit } from '../../shared/utils/rate-limit';

/**
 * AuthController — Endpoints de autenticación.
 *
 * POST /auth/login  → Login con email/password
 * GET  /auth/perfil → Obtener perfil del usuario autenticado
 */
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * POST /auth/login
     *
     * Flujo:
     * 1. Validar input (email, password).
     * 2. Autenticar contra Supabase Auth.
     * 3. Verificar perfil y empresa activa.
     * 4. Devolver sesión enriquecida o error.
     *
     * Ejemplo de body:
     * {
     *   "email": "admin@empresa.com",
     *   "password": "miPasswordSeguro123"
     * }
     */
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Req() req: Request, @Body() body: LoginDto) {
        const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown')
            .split(',')[0]
            .trim();
        const rate = consumeRateLimit(`auth-login:${ip}`, 10, 60_000);
        if (rate.limited) {
            // [SECURITY FIX] Limita fuerza bruta en login.
            throw new HttpException(
                'Demasiados intentos. Intenta nuevamente en breve.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // Validar input antes de tocar Supabase
        AuthValidator.validateLogin(body);

        // Delegar toda la lógica al servicio
        return this.authService.login(body);
    }

    /**
     * GET /auth/perfil
     *
     * Endpoint protegido. Requiere Bearer token en header Authorization.
     * Devuelve el perfil enriquecido del usuario autenticado.
     */
    @Get('perfil')
    @UseGuards(SupabaseAuthGuard)
    async perfil(@Req() req: any) {
        return {
            ok: true,
            usuario: {
                ...req.user,
            },
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() body: { refresh_token: string }) {
        return this.authService.refreshToken(body.refresh_token);
    }

    @Post('cambiar-password')
    @UseGuards(SupabaseAuthGuard)
    async cambiarPassword(
        @Req() req: any,
        @Body() body: { nuevaPassword: string },
    ) {
        return this.authService.cambiarPassword(req.user.usuario_id, body.nuevaPassword);
    }

    @Post('recuperar-password')
    @HttpCode(HttpStatus.OK)
    async recuperarPassword(@Body() body: { email: string }) {
        return this.authService.recuperarPassword(body.email);
    }
}
