import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthValidator } from './auth.validator';
import { SupabaseAuthGuard } from '../../core/auth/auth.guard';
import type { LoginDto } from './auth.types';

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
    async login(@Body() body: LoginDto) {
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
}
