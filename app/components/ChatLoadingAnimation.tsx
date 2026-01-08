import React, { useEffect } from 'react';

interface ChatLoadingAnimationProps {
  /** Primary color for the dots animation (defaults to Polaris blue) */
  primaryColor?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Size of the dots in pixels */
  dotSize?: number;
  /** Gap between dots in pixels */
  gap?: number;
}

/**
 * ChatLoadingAnimation - A modern 3-dot bouncing animation for chatbot loading states
 */
export function ChatLoadingAnimation({
  primaryColor = '#006fbb',
  ariaLabel = 'Loading response',
  dotSize = 10,
  gap = 8,
}: ChatLoadingAnimationProps) {

  useEffect(() => {
    // Inject keyframes into document head if not already present
    const styleId = 'chat-loading-animation-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes chatDotBounce {
          0%, 60%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-12px) scale(1.2);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${gap}px`,
    padding: '4px',
  };

  const dotBaseStyle: React.CSSProperties = {
    width: `${dotSize}px`,
    height: `${dotSize}px`,
    borderRadius: '50%',
    backgroundColor: primaryColor,
    animation: 'chatDotBounce 1.4s ease-in-out infinite',
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      style={containerStyle}
    >
      <div style={{ ...dotBaseStyle, animationDelay: '0s' }} />
      <div style={{ ...dotBaseStyle, animationDelay: '0.2s' }} />
      <div style={{ ...dotBaseStyle, animationDelay: '0.4s' }} />
    </div>
  );
}
