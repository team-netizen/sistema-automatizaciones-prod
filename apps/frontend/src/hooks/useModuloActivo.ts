import { useMemo } from 'react';

export function useModuloActivo(nombreModulo: string) {
  const modulosActivos = useMemo(
    () => ['operaciones', 'dashboard', 'settings', 'skills', 'executions', 'alerts'],
    [],
  );

  // [SECURITY FIX] No confiar en localStorage para decidir permisos funcionales.
  const esActivo = modulosActivos.includes(nombreModulo);

  return { esActivo, modulosActivos };
}
