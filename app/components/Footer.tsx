interface FooterLink {
  href: string;
  label: string;
}

interface FooterProps {
  leftLinks?: FooterLink[];
  rightLinks?: FooterLink[];
  copyrightText?: string;
}

export function Footer({ leftLinks = [], rightLinks = [], copyrightText }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand-logo">
              <span className="logo-icon">🤖</span>
              <span className="logo-text">Shopibot</span>
            </div>
            <p className="brand-tagline">
              Transform your Shopify store with AI-powered shopping assistance
            </p>
          </div>

          <div className="footer-links-container">
            {leftLinks.length > 0 && (
              <div className="footer-links-section">
                <h4 className="links-title">Product</h4>
                <ul className="links-list">
                  {leftLinks.map((link, index) => (
                    <li key={index}>
                      <a href={link.href} className="footer-link">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rightLinks.length > 0 && (
              <div className="footer-links-section">
                <h4 className="links-title">Legal</h4>
                <ul className="links-list">
                  {rightLinks.map((link, index) => (
                    <li key={index}>
                      <a href={link.href} className="footer-link">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <p className="copyright">
            {copyrightText || '© 2025 Shopibot. All rights reserved.'}
          </p>
        </div>
      </div>

      <style jsx>{`
        .footer {
          background: #111827;
          color: white;
          padding: 60px 20px 30px;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer-top {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 60px;
          padding-bottom: 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 30px;
        }

        .footer-brand {
          max-width: 400px;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .logo-icon {
          font-size: 32px;
        }

        .logo-text {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .brand-tagline {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
          margin: 0;
        }

        .footer-links-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }

        .footer-links-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .links-title {
          font-size: 16px;
          font-weight: 700;
          color: white;
          margin: 0;
          margin-bottom: 8px;
        }

        .links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .footer-link {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: color 0.2s;
        }

        .footer-link:hover {
          color: white;
        }

        .footer-bottom {
          text-align: center;
        }

        .copyright {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        @media (max-width: 768px) {
          .footer {
            padding: 40px 16px 20px;
          }

          .footer-top {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .footer-links-container {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
      `}</style>
    </footer>
  );
}
