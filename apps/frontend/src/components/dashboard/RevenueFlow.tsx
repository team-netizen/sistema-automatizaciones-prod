export function RevenueFlow() {
    const bars = [
        { month: 'Mar', pct: 35 },
        { month: 'Apr', pct: 50 },
        { month: 'May', pct: 40 },
        { month: 'Jun', pct: 55 },
        { month: 'Jul', pct: 90, accent: true, label: '+$2,240' },
        { month: 'Aug', pct: 60 },
    ];

    return (
        <div className="card revenue-card">
            <div className="card-header">
                <h3>Revenue Flow</h3>
                <button className="view-all">View All &rsaquo;</button>
            </div>
            <div className="chart-area">
                <div className="y-axis">
                    <span>2.5k$</span>
                    <span>2.0K$</span>
                    <span>1.5k$</span>
                    <span>1.0k$</span>
                    <span>0.5k$</span>
                    <span>0$</span>
                </div>
                {bars.map(b => (
                    <div className="bar-group" key={b.month}>
                        <div
                            className={`bar ${b.accent ? 'bar-accent' : 'bar-default'}`}
                            style={{ height: `${b.pct}%` }}
                        >
                            {b.label && <span className="bar-label">{b.label}</span>}
                            {b.accent && <span className="bar-dot" />}
                        </div>
                        <span className="bar-month">{b.month}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
