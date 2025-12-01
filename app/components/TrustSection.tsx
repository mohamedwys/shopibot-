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

      <style jsx>{`
        .trust-section {
          padding: 80px 20px;
          background: white;
          border-top: 1px solid #f3f4f6;
          border-bottom: 1px solid #f3f4f6;
        }

        .trust-container {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .trust-text {
          font-size: 16px;
          color: #6b7280;
          margin: 0 0 40px 0;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .trust-logos {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 60px;
          flex-wrap: wrap;
          margin-bottom: 60px;
        }

        .trust-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0.6;
          transition: opacity 0.3s;
        }

        .trust-logo:hover {
          opacity: 1;
        }

        .logo-icon {
          font-size: 48px;
        }

        .logo-name {
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
        }

        .trust-badges {
          display: flex;
          justify-content: center;
          gap: 40px;
          flex-wrap: wrap;
        }

        .trust-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #f9fafb;
          border-radius: 50px;
          border: 1px solid #f3f4f6;
        }

        .badge-icon {
          font-size: 20px;
        }

        .badge-text {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        @media (max-width: 640px) {
          .trust-section {
            padding: 60px 16px;
          }

          .trust-logos {
            gap: 32px;
          }

          .logo-icon {
            font-size: 36px;
          }

          .trust-badges {
            flex-direction: column;
            gap: 12px;
            align-items: center;
          }
        }
      `}</style>
    </section>
  );
}
