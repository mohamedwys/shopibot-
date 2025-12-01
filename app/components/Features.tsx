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

    </section>
  );
}
