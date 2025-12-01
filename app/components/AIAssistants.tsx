export function AIAssistants() {
  const assistants = [
    {
      icon: '🛍️',
      title: 'Product Expert',
      description: 'Helps customers find the perfect products based on their needs, preferences, and budget.',
      color: '#667eea',
    },
    {
      icon: '📦',
      title: 'Order Tracker',
      description: 'Provides real-time order status updates, shipping information, and delivery estimates.',
      color: '#764ba2',
    },
    {
      icon: '💡',
      title: 'Support Assistant',
      description: 'Answers FAQs, handles returns, and resolves common customer service inquiries instantly.',
      color: '#f59e0b',
    },
    {
      icon: '🎯',
      title: 'Sales Optimizer',
      description: 'Identifies upsell opportunities and suggests complementary products to maximize cart value.',
      color: '#10b981',
    },
  ];

  return (
    <section className="ai-assistants-section">
      <div className="ai-assistants-container">
        <div className="ai-assistants-header">
          <span className="ai-assistants-badge">AI Assistants</span>
          <h2 className="ai-assistants-title">
            Meet Your
            <span className="ai-assistants-highlight"> AI Team</span>
          </h2>
          <p className="ai-assistants-subtitle">
            Multiple specialized AI assistants working together to serve your customers
          </p>
        </div>

        <div className="ai-assistants-grid">
          {assistants.map((assistant, index) => (
            <div key={index} className="ai-assistant-card">
              <div className="assistant-icon" style={{ background: assistant.color }}>
                {assistant.icon}
              </div>
              <h3 className="assistant-title">{assistant.title}</h3>
              <p className="assistant-description">{assistant.description}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
