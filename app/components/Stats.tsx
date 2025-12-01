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

      <style jsx>{`
        .stats-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 80px 20px;
          position: relative;
          overflow: hidden;
        }

        .stats-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
        }

        .stats-container {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
        }

        .stat-card {
          text-align: center;
          color: white;
        }

        .stat-icon {
          font-size: 48px;
          margin-bottom: 16px;
          animation: float 3s ease-in-out infinite;
        }

        .stat-icon:nth-child(2) {
          animation-delay: 0.5s;
        }

        .stat-icon:nth-child(3) {
          animation-delay: 1s;
        }

        .stat-icon:nth-child(4) {
          animation-delay: 1.5s;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .stat-value {
          font-size: 56px;
          font-weight: 800;
          margin-bottom: 8px;
          line-height: 1;
          letter-spacing: -1px;
        }

        .stat-label {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
        }

        @media (max-width: 968px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 32px;
          }

          .stat-value {
            font-size: 48px;
          }
        }

        @media (max-width: 640px) {
          .stats-section {
            padding: 60px 16px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .stat-value {
            font-size: 40px;
          }
        }
      `}</style>
    </section>
  );
}
