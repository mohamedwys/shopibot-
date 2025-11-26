# iHeard.ai - Shopify AI Sales Assistant App

## Overview

iHear.ai is a Shopify embedded app that provides an AI-powered sales assistant to help customers find products, get recommendations, and receive personalized shopping assistance. The app is built with Remix, TypeScript, and integrates with N8N for AI workflow processing.

## Features

### 🤖 AI Sales Assistant
- **Intelligent Chat Interface**: Real-time conversation with AI assistant
- **Product Recommendations**: AI-powered product suggestions based on customer queries
- **Context-Aware Responses**: Understands customer intent and provides relevant information
- **Multi-Topic Support**: Handles questions about pricing, shipping, returns, product details, and more

### 🛍️ Shopify Integration
- **Embedded App**: Seamlessly integrated into Shopify admin
- **Theme Extension**: Floating chat widget that can be embedded in any theme
- **Product Data Access**: Real-time access to store products via GraphQL API
- **Secure Authentication**: Proper Shopify OAuth and session management

### 🔧 AI Workflow Configuration
- **Dual Workflow Support**: Default developer workflow or custom N8N integration
- **Admin Panel Configuration**: Easy per-store webhook URL setup
- **Dynamic Switching**: Switch between workflows without code changes
- **Fallback System**: Automatic fallback to local processing when webhooks fail
- **Per-Store Customization**: Each store can use different AI workflows

## Project Structure

```
ihear-ai/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx                 # Main app dashboard
│   │   ├── app.sales-assistant-simple.tsx # Sales assistant interface
│   │   └── apps.sales-assistant-api.tsx   # API endpoint for theme extension
│   ├── services/
│   │   └── n8n.service.ts                 # N8N integration service
│   └── shopify.server.ts                  # Shopify authentication
├── extensions/
│   └── sales-assistant-widget/
│       └── blocks/
│           └── ai_sales_assistant.liquid  # Theme extension widget
├── N8N_SETUP.md                          # N8N setup guide
└── PROJECT_SUMMARY.md                    # This file
```

## Key Components

### 1. Sales Assistant Interface (`app.sales-assistant-simple.tsx`)
- Admin-facing chat interface
- Real-time messaging with AI
- Product recommendation display
- Conversation history management

### 2. Theme Extension Widget (`ai_sales_assistant.liquid`)
- Customer-facing floating chat widget
- Responsive design for mobile and desktop
- Customizable appearance through Shopify theme editor
- JavaScript-powered real-time communication

### 3. N8N Service (`n8n.service.ts`)
- Handles communication with N8N workflows
- Provides fallback processing when N8N is unavailable
- Structured request/response handling
- Error handling and logging

### 4. API Endpoint (`apps.sales-assistant-api.tsx`)
- Secure API for theme extension communication
- Product data fetching via Shopify GraphQL
- Request authentication and validation
- Response formatting

## Installation & Setup

### Prerequisites
- Node.js 18.20+ or 20.10+
- Shopify Partner account
- Shopify CLI 3.82.1+

### 1. Clone and Install
```bash
git clone <repository-url>
cd ihear-ai
npm install
```

### 2. Configure Shopify App
The app is already configured with:
- **App Name**: ihear.ai
- **Client ID**: e7580c948724f6355548e0ad28d43e95
- **Scopes**: write_products
- **Embedded**: true

### 3. Set Up N8N (Optional)
Follow the instructions in `N8N_SETUP.md` to configure N8N workflows.

### 4. Development
```bash
npm run dev
```

### 5. Deploy
```bash
npm run deploy
```

## Usage

### For Store Owners (Admin)
1. Install the app from Shopify App Store
2. Navigate to the "AI Sales Assistant" section
3. Test the chat interface
4. Configure the theme extension settings

### For Customers (Storefront)
1. Look for the floating chat button on the store
2. Click to open the AI assistant
3. Ask questions about products, pricing, shipping, etc.
4. Receive personalized recommendations

## Customization

### Admin Settings Panel
Configure the widget through the comprehensive admin panel at `/app/settings`:

**Widget Configuration:**
- **Enable/Disable**: Toggle widget on/off across the store
- **Position Settings**: 6 positioning options (corners and center sides)
- **Button Text**: Customize the chat button text
- **Chat Title**: Set the chat window title
- **Welcome Message**: Customize the initial greeting
- **Input Placeholder**: Set placeholder text for the input field
- **Primary Color**: Full color picker with real-time preview
- **Live Preview**: See changes instantly in the preview area

**AI Workflow Configuration:**
- **Workflow Type Selection**: Choose between default and custom N8N workflows
- **Default Workflow**: Pre-configured AI assistant with product recommendations
- **Custom N8N Workflow**: Configure your own webhook URL for advanced AI processing
- **Dynamic Switching**: Switch between workflows without code changes
- **Per-Store Configuration**: Each store can have its own AI workflow settings

**Settings Management:**
- **Auto-Sync**: Changes update the storefront within 5 seconds
- **Database Persistence**: Settings survive server restarts
- **Fallback Protection**: Automatic fallback if APIs are unavailable

### AI Workflow Customization
Multiple ways to customize AI responses:

**Option 1: Use Default Workflow**
- Pre-configured product recommendations
- Built-in customer query handling
- No setup required

**Option 2: Custom N8N Workflow**
- Configure through admin panel (no code changes needed)
- Integrate with external AI services (OpenAI, Claude, etc.)
- Custom business logic and integrations
- Advanced analytics and tracking

**Option 3: Code-Level Customization**
- Modify the fallback logic in `n8n.service.ts`
- Add new conversation patterns
- Update default response templates

## API Reference

### Sales Assistant API
**Endpoint**: `/apps/sales-assistant-api`

**POST Request**:
```json
{
  "message": "I need a red dress for a wedding",
  "context": {
    "page": "/products/example-product",
    "productId": "123456789",
    "conversationHistory": [...]
  }
}
```

**Response**:
```json
{
  "response": "Here are some red dresses perfect for weddings:",
  "recommendations": [
    {
      "id": "gid://shopify/Product/123",
      "title": "Elegant Red Evening Dress",
      "handle": "red-evening-dress",
      "price": "129.99",
      "image": "https://...",
      "description": "Perfect for special occasions..."
    }
  ],
  "confidence": 0.9,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## N8N Integration

### Workflow Structure
1. **Webhook Trigger**: Receives requests from Shopify app
2. **Message Processing**: Analyzes customer messages
3. **Product Matching**: Finds relevant products
4. **Response Generation**: Creates helpful responses
5. **Recommendation Ranking**: Scores and ranks product suggestions

### Supported AI Services
- OpenAI GPT-4
- Custom AI models
- Local processing fallback

## Security

### Authentication
- Shopify OAuth 2.0
- Session-based authentication
- HMAC verification for webhooks

### Data Protection
- No sensitive data stored locally
- Secure API communication
- Rate limiting on API endpoints

## Performance

### Optimization Features
- Lazy loading of components
- Efficient product data fetching
- Caching of frequent queries
- Responsive design for all devices

### Monitoring
- Error logging and tracking
- Performance metrics
- N8N workflow execution logs

## Troubleshooting

### Common Issues
1. **Chat not responding**: Check N8N webhook URL and connectivity
2. **Products not loading**: Verify Shopify API permissions
3. **Theme extension not appearing**: Check extension installation and theme compatibility

### Debug Steps
1. Check browser console for JavaScript errors
2. Verify N8N workflow execution logs
3. Test API endpoints directly
4. Check Shopify app logs

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Test thoroughly
4. Submit pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Jest for testing

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the troubleshooting section
- Review N8N setup documentation
- Contact the development team

## Future Enhancements

### Planned Features
- Multi-language support
- Voice chat integration
- Advanced analytics dashboard
- Integration with more AI services
- Customer preference learning
- Inventory-aware recommendations

### Technical Improvements
- GraphQL query optimization
- Real-time updates via WebSocket
- Advanced caching strategies
- Performance monitoring
- A/B testing framework

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Shopify CLI Version**: 3.82.1  
**Node.js Version**: 18.20+ 