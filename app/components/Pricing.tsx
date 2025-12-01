export function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'Perfect for small stores getting started',
      features: [
        '1,000 conversations/month',
        'Basic product recommendations',
        'Email support',
        'Standard analytics',
        'Mobile optimized',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$79',
      period: '/month',
      description: 'Best for growing businesses',
      features: [
        '10,000 conversations/month',
        'Advanced AI recommendations',
        'Priority support',
        'Advanced analytics & insights',
        'Custom branding',
        'A/B testing',
        'Multi-language support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For high-volume stores',
      features: [
        'Unlimited conversations',
        'Dedicated AI training',
        '24/7 phone support',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'White-label solution',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section className="pricing-section" id="pricing">
      <div className="pricing-container">
        <div className="pricing-header">
          <span className="pricing-badge">Pricing</span>
          <h2 className="pricing-title">
            Simple, Transparent
            <span className="pricing-highlight"> Pricing</span>
          </h2>
          <p className="pricing-subtitle">
            Start free for 14 days. No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <div className="popular-badge">Most Popular</div>}

              <div className="plan-header">
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="price">{plan.price}</span>
                  <span className="period">{plan.period}</span>
                </div>
                <p className="plan-description">{plan.description}</p>
              </div>

              <ul className="plan-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="feature-item">
                    <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .pricing-section {
          padding: 100px 20px;
          background: white;
        }

        .pricing-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .pricing-badge {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }

        .pricing-title {
          font-size: 48px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .pricing-highlight {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pricing-subtitle {
          font-size: 20px;
          color: #6b7280;
          margin: 0;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          align-items: stretch;
        }

        .pricing-card {
          background: white;
          border: 2px solid #f3f4f6;
          border-radius: 20px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pricing-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          border-color: #667eea;
        }

        .pricing-card.popular {
          border-color: #667eea;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.15);
          transform: scale(1.05);
        }

        .pricing-card.popular:hover {
          transform: scale(1.05) translateY(-8px);
        }

        .popular-badge {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        }

        .plan-header {
          margin-bottom: 32px;
        }

        .plan-name {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px 0;
        }

        .plan-price {
          margin-bottom: 12px;
        }

        .price {
          font-size: 56px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          letter-spacing: -1px;
        }

        .period {
          font-size: 20px;
          color: #6b7280;
          margin-left: 4px;
        }

        .plan-description {
          font-size: 16px;
          color: #6b7280;
          margin: 0;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 32px 0;
          flex: 1;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          font-size: 16px;
          color: #374151;
        }

        .check-icon {
          width: 24px;
          height: 24px;
          color: #4ade80;
          flex-shrink: 0;
        }

        .plan-cta {
          width: 100%;
          padding: 16px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .plan-cta.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .plan-cta.primary:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .plan-cta.secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .plan-cta.secondary:hover {
          background: #f9fafb;
        }

        @media (max-width: 968px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .pricing-card.popular {
            transform: scale(1);
          }

          .pricing-card.popular:hover {
            transform: translateY(-8px);
          }

          .pricing-title {
            font-size: 36px;
          }
        }

        @media (max-width: 640px) {
          .pricing-section {
            padding: 60px 16px;
          }

          .pricing-title {
            font-size: 32px;
          }

          .pricing-subtitle {
            font-size: 18px;
          }

          .pricing-card {
            padding: 32px 24px;
          }

          .price {
            font-size: 48px;
          }
        }
      `}</style>
    </section>
  );
}
