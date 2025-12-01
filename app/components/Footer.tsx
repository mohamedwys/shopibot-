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

    </footer>
  );
}
