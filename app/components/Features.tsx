export function Features() {
  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Conversations',
      description: 'Natural language processing understands customer intent and provides accurate, helpful responses instantly.',
    },
    {
      icon: '🎯',
      title: 'Smart Product Recommendations',
      description: 'Machine learning algorithms analyze customer behavior to suggest the perfect products at the right time.',
    },
    {
      icon: '⚡',
      title: '3-Minute Setup',
      description: 'Install and configure in minutes. No coding required. Start serving customers immediately.',
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Real-time insights into customer interactions, conversion rates, and sales performance.',
    },
    {
      icon: '🌍',
      title: 'Multi-Language Support',
      description: 'Serve customers worldwide with automatic language detection and translation in 95+ languages.',
    },
    {
      icon: '🔄',
      title: 'Order Tracking Integration',
      description: 'Automatically handle order status queries, shipping updates, and return requests.',
    },
    {
      icon: '💬',
      title: '24/7 Availability',
      description: 'Never miss a sale. Your AI assistant works around the clock, even when you sleep.',
    },
    {
      icon: '🎨',
      title: 'Fully Customizable',
      description: 'Match your brand with custom colors, messaging, and personality. Make it truly yours.',
    },
    {
      icon: '🔒',
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security with GDPR compliance. Your customer data is always protected.',
    },
  ];

  return (
    <section className="features-section">
      <div className="features-container">
        <div className="features-header">
          <span className="features-badge">Features</span>
          <h2 className="features-title">
            Everything You Need to
            <span className="features-highlight"> Scale Your Store</span>
          </h2>
          <p className="features-subtitle">
            Powerful AI features designed to boost conversions and delight your customers
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .features-section {
          padding: 100px 20px;
          background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
        }

        .features-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .features-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .features-badge {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }

        .features-title {
          font-size: 48px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .features-highlight {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .features-subtitle {
          font-size: 20px;
          color: #6b7280;
          margin: 0;
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .feature-card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          border: 2px solid #f3f4f6;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          border-color: #667eea;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.2);
        }

        .feature-card:hover::before {
          opacity: 0.05;
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .feature-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 12px 0;
          position: relative;
          z-index: 1;
        }

        .feature-description {
          font-size: 16px;
          color: #6b7280;
          line-height: 1.6;
          margin: 0;
          position: relative;
          z-index: 1;
        }

        @media (max-width: 968px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }

          .features-title {
            font-size: 36px;
          }

          .feature-card {
            padding: 24px;
          }
        }

        @media (max-width: 640px) {
          .features-section {
            padding: 60px 16px;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .features-title {
            font-size: 32px;
          }

          .features-subtitle {
            font-size: 18px;
          }

          .feature-card {
            padding: 20px;
          }

          .feature-icon {
            font-size: 40px;
          }
        }
      `}</style>
    </section>
  );
}
