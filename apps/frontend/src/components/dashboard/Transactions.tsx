export function Transactions() {
    const txs = [
        { id: 1, name: 'Figma', amount: '-$15,00', bg: '#6366f1', icon: 'F' },
        { id: 2, name: 'Grammarly', amount: '-$10,00', bg: '#3edb9f', icon: 'G' },
        { id: 3, name: 'Blender', amount: '-$15,00', bg: '#f59e0b', icon: 'B' },
    ];

    return (
        <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
                <h3>Transactions</h3>
                <button className="view-all">View All &rsaquo;</button>
            </div>
            <div className="tx-list">
                {txs.map(tx => (
                    <div className="tx-item" key={tx.id}>
                        <div className="tx-left">
                            <div className="tx-icon" style={{ background: tx.bg, color: '#fff' }}>
                                {tx.icon}
                            </div>
                            <span className="tx-name">{tx.name}</span>
                        </div>
                        <span className="tx-amount">{tx.amount}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
