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
          <div className="floating-cta-subtitle">Start your 7-day free trial today</div>
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

    </div>
  );
}
