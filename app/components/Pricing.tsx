export function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '$25',
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
            Start free for 7 days. No credit card required. Cancel anytime.
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

    </section>
  );
}
