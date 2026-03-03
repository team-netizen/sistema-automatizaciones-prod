import { useMemo } from 'react';

export function useModuloActivo(nombreModulo: string) {
    // Simulación de usuario con módulos activos (SaaS Ready)
    // En el futuro vendrá de un contexto o estado global (Redux/Zustand)
    const usuarioRaw = localStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

    const modulosActivos = useMemo(() => {
        // Por defecto activamos operaciones para demo si no hay configuración
        if (!usuario?.modulos_activos) return ['operaciones', 'dashboard', 'settings', 'skills', 'executions', 'alerts'];
        return usuario.modulos_activos;
    }, [usuario]);

    const esActivo = modulosActivos.includes(nombreModulo);

    return { esActivo, modulosActivos };
}
