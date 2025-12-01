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

      <style jsx>{`
        .ai-assistants-section {
          padding: 100px 20px;
          background: white;
        }

        .ai-assistants-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .ai-assistants-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .ai-assistants-badge {
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

        .ai-assistants-title {
          font-size: 48px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .ai-assistants-highlight {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .ai-assistants-subtitle {
          font-size: 20px;
          color: #6b7280;
          margin: 0;
        }

        .ai-assistants-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        .ai-assistant-card {
          background: white;
          padding: 32px 24px;
          border-radius: 16px;
          border: 2px solid #f3f4f6;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ai-assistant-card:hover {
          transform: translateY(-8px);
          border-color: #667eea;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.15);
        }

        .assistant-icon {
          width: 80px;
          height: 80px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          margin: 0 auto 20px;
          transition: transform 0.3s;
        }

        .ai-assistant-card:hover .assistant-icon {
          transform: scale(1.1) rotate(5deg);
        }

        .assistant-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 12px 0;
        }

        .assistant-description {
          font-size: 15px;
          color: #6b7280;
          line-height: 1.6;
          margin: 0;
        }

        @media (max-width: 968px) {
          .ai-assistants-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .ai-assistants-title {
            font-size: 36px;
          }
        }

        @media (max-width: 640px) {
          .ai-assistants-section {
            padding: 60px 16px;
          }

          .ai-assistants-grid {
            grid-template-columns: 1fr;
          }

          .ai-assistants-title {
            font-size: 32px;
          }

          .ai-assistants-subtitle {
            font-size: 18px;
          }

          .ai-assistant-card {
            padding: 24px 20px;
          }
        }
      `}</style>
    </section>
  );
}
