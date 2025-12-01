export function TrustSection() {
  const logos = [
    { name: 'Shopify', icon: '🛍️' },
    { name: 'Stripe', icon: '💳' },
    { name: 'OpenAI', icon: '🧠' },
    { name: 'AWS', icon: '☁️' },
    { name: 'Google Cloud', icon: '🌐' },
  ];

  return (
    <section className="trust-section">
      <div className="trust-container">
        <p className="trust-text">Trusted by leading e-commerce brands worldwide</p>

        <div className="trust-logos">
          {logos.map((logo, index) => (
            <div key={index} className="trust-logo">
              <span className="logo-icon">{logo.icon}</span>
              <span className="logo-name">{logo.name}</span>
            </div>
          ))}
        </div>

        <div className="trust-badges">
          <div className="trust-badge">
            <span className="badge-icon">🔒</span>
            <span className="badge-text">GDPR Compliant</span>
          </div>
          <div className="trust-badge">
            <span className="badge-icon">✓</span>
            <span className="badge-text">SOC 2 Certified</span>
          </div>
          <div className="trust-badge">
            <span className="badge-icon">🛡️</span>
            <span className="badge-text">256-bit Encryption</span>
          </div>
        </div>
      </div>

    </section>
  );
}
