import { Form } from "@remix-run/react";

export function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-container">
        <div className="hero-content">
          {/* Badge */}
          <div className="hero-badge">
            <span className="badge-icon">🤖</span>
            <span className="badge-text">AI-Powered Shopping Assistant</span>
          </div>

          {/* Main Heading */}
          <h1 className="hero-heading">
            Transform Your Shopify Store with
            <span className="hero-gradient-text"> AI Sales Assistant</span>
          </h1>

          {/* Subheading */}
          <p className="hero-subheading">
            Boost conversions by 300% with intelligent product recommendations,
            instant customer support, and 24/7 AI-powered shopping assistance.
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta-container">
            <Form method="post" action="/auth/login" className="hero-form">
              <div className="hero-input-group">
                <input
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  className="hero-input"
                  required
                />
                <button type="submit" className="hero-button-primary">
                  <span>Start Free Trial</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 10h12m0 0l-4-4m4 4l-4 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </Form>
            <a href="#demo" className="hero-button-secondary">
              Watch Demo
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="hero-trust">
            <div className="hero-trust-item">
              <svg className="hero-check-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>14-day free trial</span>
            </div>
            <div className="hero-trust-item">
              <svg className="hero-check-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>No credit card required</span>
            </div>
            <div className="hero-trust-item">
              <svg className="hero-check-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>3-minute setup</span>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="hero-visual">
          <div className="hero-chat-preview">
            <div className="chat-header">
              <div className="chat-avatar">🤖</div>
              <div className="chat-info">
                <div className="chat-name">AI Shopping Assistant</div>
                <div className="chat-status">
                  <span className="status-dot"></span>
                  Online
                </div>
              </div>
            </div>
            <div className="chat-messages">
              <div className="chat-message bot">
                👋 Hi! I'm your AI shopping assistant. How can I help you today?
              </div>
              <div className="chat-message user">
                Looking for a comfortable running shoe
              </div>
              <div className="chat-message bot">
                Great! I found 3 perfect matches for you based on your preferences...
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 80px 20px 60px;
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
        }

        .hero-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-content {
          color: white;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 14px;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .badge-icon {
          font-size: 18px;
        }

        .hero-heading {
          font-size: 52px;
          font-weight: 800;
          line-height: 1.1;
          margin: 0 0 24px 0;
          letter-spacing: -0.5px;
        }

        .hero-gradient-text {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subheading {
          font-size: 20px;
          line-height: 1.6;
          margin: 0 0 32px 0;
          color: rgba(255, 255, 255, 0.9);
        }

        .hero-cta-container {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }

        .hero-form {
          flex: 1;
          max-width: 500px;
        }

        .hero-input-group {
          display: flex;
          gap: 12px;
          background: white;
          padding: 6px;
          border-radius: 50px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .hero-input {
          flex: 1;
          border: none;
          padding: 14px 20px;
          font-size: 16px;
          background: transparent;
          outline: none;
        }

        .hero-button-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
          white-space: nowrap;
        }

        .hero-button-primary:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .hero-button-secondary {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
          padding: 14px 28px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: all 0.2s;
        }

        .hero-button-secondary:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .hero-trust {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .hero-trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .hero-check-icon {
          width: 20px;
          height: 20px;
          color: #4ade80;
        }

        .hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .hero-chat-preview {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }

        .chat-avatar {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .chat-info {
          flex: 1;
        }

        .chat-name {
          font-weight: 600;
          font-size: 16px;
        }

        .chat-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .chat-messages {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #fafafa;
        }

        .chat-message {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          max-width: 80%;
          animation: slideIn 0.3s ease-out;
        }

        .chat-message.bot {
          background: white;
          color: #1f2937;
          align-self: flex-start;
          border-radius: 16px 16px 16px 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .chat-message.user {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          align-self: flex-end;
          border-radius: 16px 16px 4px 16px;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 968px) {
          .hero-container {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .hero-heading {
            font-size: 40px;
          }

          .hero-cta-container {
            flex-direction: column;
          }

          .hero-form {
            max-width: 100%;
          }

          .hero-visual {
            order: -1;
          }
        }

        @media (max-width: 640px) {
          .hero-section {
            padding: 60px 16px 40px;
          }

          .hero-heading {
            font-size: 32px;
          }

          .hero-subheading {
            font-size: 18px;
          }

          .hero-input-group {
            flex-direction: column;
            gap: 8px;
            border-radius: 16px;
          }

          .hero-button-primary {
            width: 100%;
            justify-content: center;
          }

          .hero-trust {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </section>
  );
}
