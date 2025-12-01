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

    </section>
  );
}
