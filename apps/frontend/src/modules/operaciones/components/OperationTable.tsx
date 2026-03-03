import React, { useState, useMemo } from 'react';

interface Column {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

interface OperationTableProps {
    title: string;
    columns: Column[];
    data: any[];
    renderRow: (item: any) => React.ReactNode;
    isLoading?: boolean;
    totalEntries?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    accentColor?: string;
    emptyMessage?: string;
    loadingMessage?: string;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
}

export const OperationTable: React.FC<OperationTableProps> = ({
    title,
    columns,
    data,
    renderRow,
    isLoading,
    totalEntries = 0,
    accentColor = '#22C55E',
    emptyMessage = 'No se encontraron resultados',
    loadingMessage = 'Cargando...',
    pageSize: externalPageSize,
    onPageSizeChange,
}) => {
    const [internalPageSize, setInternalPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const pageSize = externalPageSize ?? internalPageSize;
    const total = totalEntries || data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Sort data
    const sortedData = useMemo(() => {
        if (!sortKey) return data;
        const col = columns.find(c => c.key === sortKey);
        if (!col?.sortable) return data;
        return [...data].sort((a, b) => {
            const aVal = a[sortKey] ?? '';
            const bVal = b[sortKey] ?? '';
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return sortDir === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [data, sortKey, sortDir, columns]);

    // Paginate
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, currentPage, pageSize]);

    const handleSort = (key: string, sortable?: boolean) => {
        if (!sortable) return;
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setInternalPageSize(newSize);
        setCurrentPage(1);
        onPageSizeChange?.(newSize);
    };

    // Generate page numbers to show
    const getPageNumbers = (): (number | '...')[] => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const showStart = ((currentPage - 1) * pageSize) + 1;
    const showEnd = Math.min(currentPage * pageSize, total);

    return (
        <div className="bg-[#111C19] border border-[#1F2D29] rounded-[24px] shadow-2xl shadow-black/20 overflow-hidden flex flex-col w-full min-h-[500px]">
            {/* ── Table Header ──────────────────────────── */}
            <div className="px-6 md:px-8 py-5 md:py-6 border-b border-[#1F2D29] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: accentColor }}></span>
                    {title}
                </h3>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Showing {showStart}-{showEnd} of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 hover:text-white hover:border-gray-500 transition-all disabled:opacity-20 disabled:hover:text-gray-500 disabled:hover:border-[#1F2D29]"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 hover:text-white hover:border-gray-500 transition-all disabled:opacity-20 disabled:hover:text-gray-500 disabled:hover:border-[#1F2D29]"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Table Content ─────────────────────────── */}
            <div className="flex-1 overflow-auto hide-scrollbar scroll-smooth">
                <table className="w-full border-separate border-spacing-0 min-w-[800px]">
                    <thead className="sticky top-0 z-10 bg-[#111C19]">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key, col.sortable)}
                                    className={`px-6 md:px-8 py-4 text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest border-b border-[#1F2D29] transition-colors select-none ${col.sortable ? 'cursor-pointer hover:text-gray-300' : ''} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                                        }`}
                                >
                                    <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                                        {col.label}
                                        {col.sortable && (
                                            <svg className={`w-3 h-3 transition-all ${sortKey === col.key ? 'text-[#22C55E] opacity-100' : 'opacity-30'}`} fill="currentColor" viewBox="0 0 24 24">
                                                {sortKey === col.key && sortDir === 'asc' ? (
                                                    <path d="M12 5l-4 4h8l-4-4z" />
                                                ) : sortKey === col.key && sortDir === 'desc' ? (
                                                    <path d="M12 19l4-4H8l4 4z" />
                                                ) : (
                                                    <path d="M12 5l-4 4h8l-4-4zM12 19l4-4H8l4 4z" />
                                                )}
                                            </svg>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-6 md:px-8 py-5 border-b border-[#1F2D29]/20">
                                                <div className="h-4 bg-[#1F2D29] rounded-full w-24 mx-auto lg:mx-0"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={columns.length} className="px-8 py-8 text-center">
                                        <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">{loadingMessage}</p>
                                    </td>
                                </tr>
                            </>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-8 py-24 text-center">
                                    <div className="w-16 h-16 rounded-full bg-[#0B1412] border border-[#1F2D29] flex items-center justify-center text-2xl mx-auto mb-4 opacity-20">🔎</div>
                                    <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-xs">{emptyMessage}</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((item) => renderRow(item))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Table Footer / Pagination ─────────────── */}
            <div className="px-6 md:px-8 py-4 md:py-5 border-t border-[#1F2D29] bg-[#0B1412]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Records per page */}
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Records per page:</span>
                    <div className="relative">
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="appearance-none bg-[#111C19] border border-[#1F2D29] rounded-lg text-xs font-bold text-gray-300 pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#22C55E]/50 transition-all cursor-pointer"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <svg className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>

                {/* Page numbers */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 text-[10px] font-bold hover:text-white hover:border-gray-500 transition-all disabled:opacity-20"
                        title="First"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 text-[10px] font-bold hover:text-white hover:border-gray-500 transition-all disabled:opacity-20"
                        title="Previous"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    {getPageNumbers().map((page, idx) =>
                        page === '...' ? (
                            <span key={`dot-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-600 text-xs font-bold">…</span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page as number)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-all ${currentPage === page
                                    ? 'bg-[#22C55E] text-[#0B1412] shadow-lg shadow-[#22C55E]/30'
                                    : 'border border-[#1F2D29] text-gray-400 hover:text-white hover:border-gray-500'
                                    }`}
                            >
                                {page}
                            </button>
                        )
                    )}

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 text-[10px] font-bold hover:text-white hover:border-gray-500 transition-all disabled:opacity-20"
                        title="Next"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1F2D29] text-gray-500 text-[10px] font-bold hover:text-white hover:border-gray-500 transition-all disabled:opacity-20"
                        title="Last"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
