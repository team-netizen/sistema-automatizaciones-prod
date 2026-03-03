import React from 'react';
import { useModuloActivo } from '../../hooks/useModuloActivo';

interface ModuloGuardProps {
    modulo: string;
    children: React.ReactNode;
}

export const ModuloGuard: React.FC<ModuloGuardProps> = ({ modulo, children }) => {
    const { esActivo } = useModuloActivo(modulo);

    if (!esActivo) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-12 text-center animate-fadeIn">
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/30">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-text-main mb-3 uppercase tracking-widest">Módulo Bloqueado</h2>
                <p className="text-text-muted max-w-sm mb-8 font-medium">No tienes contratada una suscripción que incluya el **Centro de Operaciones**.</p>
                <button className="px-8 py-3 bg-mint text-dark font-black rounded-xl hover:bg-mint/80 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-mint/20 tracking-widest uppercase text-sm">
                    Actualizar Plan (Upgrade)
                </button>
            </div>
        );
    }

    return <>{children}</>;
};
