import { Brain, Target, Sparkles, TrendingUp, Zap, Shield, MessageSquare, BarChart3, Globe } from 'lucide-react';
import { useState } from 'react';

const coreFeatures = [
  {
    icon: Brain,
    title: 'Advanced Intent Detection',
    description: '15+ intent types with sub-intents, sentiment analysis, and urgency detection. Understands exactly what customers need.',
    color: 'from-purple-500 to-pink-500',
    badge: 'AI Core',
    highlights: ['Sentiment Analysis', 'Entity Extraction', 'Auto-Escalation']
  },
  {
    icon: Target,
    title: 'Smart Product Intelligence',
    description: 'AI scores every product 0-100 based on relevance, stock, discounts, and reviews. Perfect recommendations every time.',
    color: 'from-blue-500 to-cyan-500',
    badge: 'Matching',
    highlights: ['Relevance Scoring', 'Stock Awareness', 'Discount Detection']
  },
  {
    icon: Sparkles,
    title: 'Rich Interactive Experience',
    description: 'Beautiful product cards with badges, quick replies, and one-click actions. "Add to Cart" and "View Details" instantly.',
    color: 'from-pink-500 to-rose-500',
    badge: 'UX Magic',
    highlights: ['Product Cards', 'Quick Replies', 'Instant Actions']
  },
  {
    icon: TrendingUp,
    title: 'Conversion Optimization',
    description: 'Creates urgency with "Only 3 left!" messages, highlights discounts, and promotes best-sellers automatically.',
    color: 'from-green-500 to-emerald-500',
    badge: 'Sales',
    highlights: ['FOMO Messages', 'Discount Highlighting', '+2.5x AOV']
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Track intent, sentiment, confidence scores, and response times. Full conversation analytics to optimize performance.',
    color: 'from-violet-500 to-purple-500',
    badge: 'Insights',
    highlights: ['Real-time Tracking', 'Confidence Scores', 'Deep Metrics']
  },
  {
    icon: MessageSquare,
    title: 'Context Memory & Personalization',
    description: 'Remembers conversation history and adapts to customer language. Natural, human-like interactions in EN, FR, ES.',
    color: 'from-indigo-500 to-blue-500',
    badge: 'Memory',
    highlights: ['10 Message History', 'Multi-Language', 'Contextual']
  },
  {
    icon: Zap,
    title: '3-Minute Setup',
    description: 'Install via n8n webhook. No coding required. Connect to Shopify and go live in under 5 minutes.',
    color: 'from-yellow-500 to-orange-500',
    badge: 'Easy',
    highlights: ['No Coding', 'Instant Deploy', 'Plug & Play']
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: '24/7 availability with spam detection, bot filtering, and GDPR compliance. Your data stays protected.',
    color: 'from-slate-600 to-gray-700',
    badge: 'Secure',
    highlights: ['GDPR Compliant', 'Always On', 'Protected']
  },
  {
    icon: Globe,
    title: 'Powered by GPT-4 Turbo',
    description: 'Best-in-class AI with advanced prompt engineering. Automatically escalates to human support when needed.',
    color: 'from-purple-600 to-pink-600',
    badge: 'Premium',
    highlights: ['GPT-4', 'Human Escalation', 'Smart Handoff']
  },
];

export function Features() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">All-in-One AI Solution</span>
          </div>
          
          <h2 className="text-5xl font-bold text-slate-900 mb-4">
            Everything You Need to
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent"> Win Customers</span>
          </h2>
          
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            The most intelligent Shopify chatbot. Advanced AI that understands, recommends, and converts better than any competitor.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {coreFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const isHovered = hoveredIndex === index;
            const isExpanded = expandedIndex === index;
            
            return (
              <div
                key={index}
                className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                {/* Gradient Border Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} transform transition-all duration-300 ${isHovered ? 'scale-110 rotate-6' : ''}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${feature.color} text-white`}>
                      {feature.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-slate-900 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-600 leading-relaxed mb-4 text-sm">
                    {feature.description}
                  </p>

                  {/* Highlights - Always Visible */}
                  <div className="flex flex-wrap gap-2">
                    {feature.highlights.map((highlight, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Gradient Line */}
                <div className={`h-1 bg-gradient-to-r ${feature.color} transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            );
          })}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              15+
            </div>
            <div className="text-sm text-slate-600 font-medium">Intent Types</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
              0-100
            </div>
            <div className="text-sm text-slate-600 font-medium">Product Scoring</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              2.5x
            </div>
            <div className="text-sm text-slate-600 font-medium">Higher AOV</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              &lt;5min
            </div>
            <div className="text-sm text-slate-600 font-medium">Setup Time</div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col md:flex-row items-center gap-6 p-8 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-2xl shadow-2xl">
            <div className="text-left text-white">
              <p className="text-2xl md:text-3xl font-bold mb-2">Ready to 10x your conversions?</p>
              <p className="text-purple-100">All features included. No credit card required. Live in 5 minutes.</p>
            </div>
            <button className="px-8 py-4 bg-white text-purple-600 font-bold rounded-xl hover:scale-105 transition-transform duration-200 shadow-lg whitespace-nowrap">
              Start Free Trial →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}