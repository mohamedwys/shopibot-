export function Stats() {
  const stats = [
    {
      value: '300%',
      label: 'Average conversion increase',
      icon: '📈',
    },
    {
      value: '10K+',
      label: 'Active Shopify stores',
      icon: '🏪',
    },
    {
      value: '24/7',
      label: 'Always-on support',
      icon: '⏰',
    },
    {
      value: '95%',
      label: 'Customer satisfaction rate',
      icon: '⭐',
    },
  ];

  return (
    <section className="stats-section">
      <div className="stats-container">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
