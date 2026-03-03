import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
    children: ReactNode;
    onLogout?: () => void;
    usuario?: any;
    activeView?: string;
    onNavigate?: (view: string) => void;
}

export function DashboardLayout({ children, onLogout, usuario, activeView, onNavigate }: DashboardLayoutProps) {
    return (
        <div className="app-layout">
            <Sidebar rol={usuario?.rol} onLogout={onLogout} activeView={activeView} onNavigate={onNavigate} />
            <div className="main-area">
                <Header usuario={usuario} />
                {children}
            </div>
        </div>
    );
}
