interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    iconBgClass?: string;
    isLoading?: boolean;
}

export const MetricCard = ({ title, value, icon, trend, iconBgClass, isLoading }: MetricCardProps) => {
    if (isLoading) {
        return (
            <div className="bg-[#111C19] border border-[#1F2D29] rounded-3xl p-7 animate-pulse">
                <div className="w-12 h-12 bg-[#1F2D29] rounded-2xl mb-5"></div>
                <div className="h-3 w-20 bg-[#1F2D29] rounded-full mb-3"></div>
                <div className="h-7 w-14 bg-[#1F2D29] rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="bg-[#111C19] border border-[#1F2D29] rounded-3xl p-7 shadow-lg shadow-black/10 hover:border-[#22C55E]/20 transition-all duration-300 group">
            {/* Icon Container */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${iconBgClass || 'bg-[#22C55E]/10'}`}>
                {icon}
            </div>

            {/* Label */}
            <p className="text-sm font-medium text-gray-400 mb-1.5">{title}</p>

            {/* Value + Trend */}
            <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
                {trend && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${trend.isPositive ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-red-500/10 text-red-400'}`}>
                        {trend.isPositive ? '+' : '-'}{trend.value}%
                    </span>
                )}
            </div>
        </div>
    );
};
