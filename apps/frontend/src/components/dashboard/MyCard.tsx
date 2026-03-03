export function MyCard() {
    return (
        <div className="balance-card">
            <div className="balance-header">
                <div>
                    <div className="balance-label">Total Balance</div>
                </div>
                <button className="balance-add">+</button>
            </div>
            <div className="balance-amount">$22,350.50</div>
            <div className="card-number">4358 4445 0968 2323</div>
            <div className="card-expiry">08/24</div>
        </div>
    );
}
