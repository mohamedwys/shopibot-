import { useState, useEffect } from 'react';

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show CTA after scrolling 500px
      setIsVisible(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`floating-cta ${isVisible ? 'visible' : ''}`}>
      <div className="floating-cta-content">
        <div className="floating-cta-text">
          <div className="floating-cta-title">Ready to transform your store?</div>
          <div className="floating-cta-subtitle">Start your 14-day free trial today</div>
        </div>
        <a href="#pricing" className="floating-cta-button">
          Get Started Free
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10h12m0 0l-4-4m4 4l-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      <style jsx>{`
        .floating-cta {
          position: fixed;
          bottom: -100px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .floating-cta.visible {
          bottom: 20px;
        }

        .floating-cta-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px 24px;
          border-radius: 16px;
          box-shadow:
            0 8px 32px rgba(102, 126, 234, 0.4),
            0 16px 64px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          gap: 24px;
          backdrop-filter: blur(10px);
        }

        .floating-cta-text {
          color: white;
        }

        .floating-cta-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .floating-cta-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .floating-cta-button {
          background: white;
          color: #667eea;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .floating-cta-button:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        @media (max-width: 768px) {
          .floating-cta-content {
            flex-direction: column;
            gap: 16px;
            padding: 16px 20px;
            text-align: center;
            max-width: calc(100vw - 32px);
          }

          .floating-cta-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
