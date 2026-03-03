export function ExpenseSummary() {
    // SVG Donut chart sizes
    const size = 120;
    const stroke = 12;
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;

    // Segment data (fractions)
    const segments = [
        { pct: 0.40, color: '#8b7af0', label: 'Food', value: '$ 950' },
        { pct: 0.28, color: '#ddf274', label: 'Clothes', value: '$ 420' },
        { pct: 0.32, color: '#3edb9f', label: 'Other', value: '$ 480' },
    ];

    let cumulativeOffset = 0;

    return (
        <div className="bottom-row">
            {/* Donut Card */}
            <div className="card donut-card">
                <div className="card-header">
                    <h3>Available</h3>
                    <button className="view-all">View All &rsaquo;</button>
                </div>

                <div className="donut-area">
                    <div className="donut-ring">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                            {segments.map((seg, i) => {
                                const dashArray = circumference * seg.pct;
                                const dashOffset = -cumulativeOffset;
                                cumulativeOffset += dashArray;
                                return (
                                    <circle
                                        key={i}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={r}
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth={stroke}
                                        strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                                        strokeDashoffset={dashOffset}
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                        </svg>
                        <div className="donut-center">
                            <div className="amount">$1,750</div>
                            <div className="label">Total Expenses</div>
                        </div>
                    </div>

                    <div className="legend">
                        {segments.map((seg, i) => (
                            <div className="legend-item" key={i}>
                                <span className="legend-dot" style={{ background: seg.color }} />
                                <span>{seg.label}</span>
                                <span className="legend-value">{seg.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Income */}
            <div className="card stat-card">
                <div className="stat-label">Income</div>
                <div className="stat-amount">$2,240</div>
                <div className="stat-sub">This week's income</div>
                <span className="stat-badge badge-green">+12%</span>
            </div>

            {/* Expense */}
            <div className="card stat-card">
                <div className="stat-label">Expense</div>
                <div className="stat-amount">$1,750</div>
                <div className="stat-sub">This week's expense</div>
                <span className="stat-badge badge-purple">-9%</span>
            </div>
        </div>
    );
}
