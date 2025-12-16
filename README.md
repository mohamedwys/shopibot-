
# AI Sales Assistant for Shopify

An intelligent AI-powered sales assistant widget for Shopify stores that helps customers find products, answer questions, and provide personalized recommendations.

## 📋 Features

- **🎯 Smart Product Recommendations** - AI-powered product suggestions based on customer queries
- **💬 Real-time Chat Interface** - Floating chat widget with customizable positioning
- **🎨 Fully Customizable** - Admin panel to configure colors, text, position, and behavior
- **📱 Mobile Responsive** - Optimized for all device sizes
- **🔌 N8N Integration** - Optional integration with N8N workflows for advanced AI processing
- **⚡ Real-time Updates** - Settings changes reflect immediately on the storefront
- **🛡️ Secure** - Built with Shopify's security best practices

## 🏗️ Architecture

- **Frontend**: Remix with TypeScript and Shopify Polaris UI
- **Backend**: Node.js with Prisma ORM and SQLite database
- **Theme Extension**: Liquid template with vanilla JavaScript
- **AI Integration**: N8N webhooks with fallback processing
- **Authentication**: Shopify OAuth with session management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Shopify Partner account
- Shopify CLI 3.0+

### Installation

1. **Clone the repository**
  

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Shopify app credentials
   ```
   
   **Required values for `.env`:**
   - `SHOPIFY_API_KEY`: Get from Shopify Partner Dashboard > Apps > [Your App] > App setup (Client ID)
   - `SHOPIFY_SALES_ASSISTANT_WIDGET_ID`: Generate a UUID at [uuidgenerator.net](https://www.uuidgenerator.net/)
   
   **Optional N8N Integration:**
   - `N8N_WEBHOOK_URL`: Your N8N webhook URL for AI processing
   - `N8N_API_KEY`: N8N API key (if authentication required)
   
   See `SETUP.md` for detailed instructions on obtaining these values.
   See `N8N_SETUP.md` for complete N8N workflow setup.

4. **Configure Shopify app**
   ```bash
   cp shopify.app.example.toml shopify.app.toml
   # Edit shopify.app.toml with your app details
   ```

5. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

6. **Start development server**
   ```bash
   shopify app dev
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=your_widget_id_here
```

### Shopify App Configuration

Update `shopify.app.toml` with your app details:

```toml
client_id = "your_shopify_app_client_id"
name = "ihear.ai"
application_url = "https://your-tunnel-url.trycloudflare.com"
```

## 📁 Project Structure

```
ihear-ai/
├── app/                          # Remix application
│   ├── routes/                   # App routes
│   │   ├── app.settings.tsx      # Admin settings page
│   │   ├── api.widget-settings.tsx # Widget settings API
│   │   └── apps.sales-assistant-api.tsx # AI chat API
│   ├── db.server.ts              # Database connection
│   └── shopify.server.ts         # Shopify authentication
├── extensions/                   # Shopify theme extensions
│   └── sales-assistant-widget/   # AI widget extension
│       ├── blocks/               # Theme blocks
│       │   └── ai_sales_assistant.liquid # Main widget
│       ├── assets/               # Static assets
│       ├── locales/              # Translations
│       └── snippets/             # Reusable snippets
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
└── services/                     # External services
    └── n8n.service.ts            # N8N integration
```

## 🎛️ Admin Panel Features

### Widget Configuration
- **Enable/Disable** - Toggle widget on/off across the store
- **Position Settings** - 6 positioning options (corners and center sides)
- **Customization** - Button text, chat title, welcome message, placeholder text
- **Color Picker** - Fully functional color customization
- **Live Preview** - See changes in real-time

### AI Workflow Configuration
- **Default Workflow** - Use the developer's pre-configured AI assistant with product recommendations
- **Custom N8N Workflow** - Configure your own N8N webhook URL for custom AI processing
- **Dynamic Switching** - Easily switch between default and custom workflows
- **Fallback Protection** - Automatic fallback to local processing if webhooks fail

### Settings Auto-Sync
- Changes in admin panel update the storefront within 5 seconds
- Database persistence ensures settings survive server restarts
- Fallback to default settings if API is unavailable

## 🔧 Development

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name description

# Reset database (development only)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Local Development Workflow

⚠️ **Important for Local Development**: Every time you restart `shopify app dev`, you must update the **App Proxy URL** in your Shopify Partner Dashboard because the tunnel URL changes.

**Quick Steps:**
1. Check your new tunnel URL in `shopify.app.toml` → `application_url`
2. Update the proxy URL in Partner Dashboard → Apps → [Your App] → App setup → App proxy
3. Set proxy URL to: `https://NEW-TUNNEL-URL.trycloudflare.com/api/widget-settings`

**Why this matters:**
- The widget needs to fetch settings from your app's API
- Tunnel URLs change on each restart for security
- Without updating the proxy URL, you'll get "Failed to fetch" errors

See `SETUP.md` for detailed instructions on app proxy configuration.

### Theme Extension Development

The widget is built as a Shopify theme extension block that can be added to any theme template. It automatically:

- Fetches configuration from the admin panel
- Applies custom styling and positioning
- Handles real-time chat interactions
- Integrates with the AI backend

### API Endpoints

- `GET /api/widget-settings` - Fetch widget configuration
- `POST /apps/sales-assistant-api` - Process AI chat messages

## 🤖 AI Integration

### Two Workflow Options

**1. Default Developer Workflow**
- Pre-configured AI assistant with product recommendations
- Works out-of-the-box with no additional setup
- Integrated with your store's product catalog
- Handles common customer queries automatically

**2. Custom N8N Workflow**
- Configure your own N8N webhook URL through the admin panel
- Advanced AI processing with full customization
- Integrate with external AI services (OpenAI, Claude, etc.)
- Custom business logic and integrations

### Configuration

**Admin Panel Configuration:**
1. Go to **App Settings** → **AI Workflow Configuration**
2. Choose between "Use Developer's Default Workflow" or "Use My Custom N8N Workflow"
3. If using custom: Enter your N8N webhook URL (must be HTTPS)
4. Save settings - changes take effect immediately

**Environment Configuration (Optional):**
- Set `N8N_WEBHOOK_URL` in `.env` for a global default
- Individual stores can override this with their own webhook URLs
- Supports both shared and per-store N8N configurations

### Fallback Processing

The app provides robust fallback protection:
- If custom webhook fails → Falls back to local processing
- If network issues occur → Provides helpful default responses
- Ensures chat widget always works regardless of external dependencies

## 🚀 Deployment

### Development Deployment

The app runs in development mode with Shopify CLI:

```bash
shopify app dev
```

⚠️ **Note:** Tunnel URLs change on each restart. For production use, deploy to a hosting platform.

### Production Deployment

Deploy to production for a stable URL and eliminate proxy URL issues:

**Quick Deploy (5 minutes):**
- 📘 [Quick Deploy Guide](QUICK_DEPLOY.md) - Railway deployment in 5 minutes

**Full Deployment Options:**
- 📗 [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Railway, Render, Heroku
  - Railway (Recommended) - Easiest with GitHub auto-deploy
  - Render - Free tier available
  - Heroku - Classic and reliable

**What you get with production deployment:**
- ✅ Stable URL (no more tunnel URL changes)
- ✅ Automatic SSL certificate
- ✅ PostgreSQL database
- ✅ Auto-deploy from GitHub
- ✅ Professional hosting
- ✅ Monitoring and logs

**Quick Railway Deploy:**
1. Push code to GitHub
2. Sign up at [railway.app](https://railway.app)
3. Deploy from GitHub repo
4. Add environment variables
5. Generate domain
6. Update Shopify Partner Dashboard
7. Done! 🎉

See [QUICK_DEPLOY.md](QUICK_DEPLOY.md) for detailed steps.

## 🔒 Security Considerations

- **API Keys**: Never commit `.env` or `shopify.app.toml` files
- **Database**: SQLite is suitable for development; use PostgreSQL for production
- **CORS**: Widget API includes proper CORS headers for cross-origin requests
- **Authentication**: All admin routes require Shopify OAuth authentication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Shopify App Development](https://shopify.dev/docs/apps)
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🙏 Acknowledgments

- Built with [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- UI components from [Shopify Polaris](https://polaris.shopify.com/)
- Database ORM by [Prisma](https://www.prisma.io/)
- Web framework by [Remix](https://remix.run/)

---

# shopibot-
# Deployment trigger Tue Dec 16 19:43:04 UTC 2025
