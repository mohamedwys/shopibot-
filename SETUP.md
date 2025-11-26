# 🔧 Setup Guide

This guide will help you set up the project after cloning from GitHub.

## 🔐 Required Configuration Files

The following files contain sensitive information and are not included in the repository. You need to create them manually.

### 1. Environment Variables (`.env`)

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` with your actual values:

```env
# Get this from your Shopify Partner Dashboard > Apps > [Your App] > App setup
# This is the same as your "Client ID" from the Shopify Partner Dashboard
SHOPIFY_API_KEY=your_shopify_api_key_here

# Generate a unique UUID for your widget (you can use: https://www.uuidgenerator.net/)
# This identifies your specific widget instance and can be any unique UUID
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=your_widget_id_here

# Optional: N8N webhook URL for AI processing
N8N_WEBHOOK_URL=your_n8n_webhook_url_here
```

#### 📝 How to Get These Values:

**SHOPIFY_API_KEY**:
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to "Apps" → Select your app
3. Go to "App setup" tab
4. Copy the **Client ID** value (this is your API key)

**SHOPIFY_SALES_ASSISTANT_WIDGET_ID**:
1. Visit [UUID Generator](https://www.uuidgenerator.net/)
2. Click "Generate" to create a new UUID v4
3. Copy the generated UUID (e.g., `bc053588-7383-478e-b5d1-e95f343d267e`)
4. This uniquely identifies your widget instance

**N8N_WEBHOOK_URL** (Optional):
1. **Install N8N**: Use Docker, npm, or N8N Cloud (see `N8N_SETUP.md` for details)
2. **Create workflow**: Import the sales assistant workflow template
3. **Get webhook URL**: Copy from the Webhook trigger node in your workflow

> **Note**: You can also configure N8N webhook URLs on a per-store basis through the admin panel without setting this environment variable. See the "AI Workflow Configuration" section below.
4. **Format**: `https://your-n8n-instance.com/webhook/abc123def456`
5. **Test**: Send a test request to verify the webhook works

**N8N_API_KEY** (Optional):
- Only required if your N8N instance has authentication enabled
- Generate in N8N Settings → API Keys
- Leave blank if using N8N without authentication

### 2. Shopify App Configuration (`shopify.app.toml`)

Create the Shopify app configuration file:

```bash
# Copy the example file
cp shopify.app.example.toml shopify.app.toml
```

Then edit `shopify.app.toml` with your actual values:

```toml
# Get this from your Shopify Partner Dashboard
client_id = "your_shopify_app_client_id_here"

# This will be automatically updated when you run 'shopify app dev'
application_url = "https://your-tunnel-url.trycloudflare.com"

# Update redirect URLs to match your tunnel URL
[auth]
redirect_urls = [
  "https://your-tunnel-url.trycloudflare.com/auth/callback",
  "https://your-tunnel-url.trycloudflare.com/auth/shopify/callback",
  "https://your-tunnel-url.trycloudflare.com/api/auth/callback"
]
```

## 🏪 Shopify Partner Setup

### 1. Create a Shopify Partner Account

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Sign up for a Partner account
3. Complete the verification process

### 2. Create a New App

1. In Partner Dashboard, click "Apps" → "Create app"
2. Choose "Create app manually"
3. Fill in the app details:
   - **App name**: `iheard.ai` (or your preferred name)
   - **App URL**: Leave blank for now (will be auto-filled)
   - **Allowed redirection URL(s)**: Leave blank for now

### 3. Get Your API Credentials

1. After creating the app, go to "App setup"
2. Copy the **Client ID** (this is your `SHOPIFY_API_KEY` for the `.env` file)
3. Note down the **Client secret** (you may need this later)
4. The Client ID is also used as `client_id` in your `shopify.app.toml` file

### 4. Create a Development Store

1. In Partner Dashboard, go to "Stores" → "Add store"
2. Choose "Development store"
3. Fill in store details and create the store
4. This store will be used for testing your app

## 🚀 First Run

After setting up the configuration files:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

3. **Set up database**:
   ```bash
   npx prisma migrate dev
   ```

4. **Start development server**:
   ```bash
   shopify app dev
   ```

5. **Follow the CLI prompts**:
   - Select your Partner organization
   - Choose your app
   - Select your development store
   - The CLI will automatically update `shopify.app.toml` with the tunnel URL

## 📡 App Proxy URL Management (Important for Local Development)

### Understanding Tunnel URLs vs Proxy URLs

When developing locally, Shopify CLI creates a **tunnel URL** that exposes your local server to the internet. This tunnel URL changes **every time you restart** `shopify app dev`.

- **Tunnel URL**: Base URL (e.g., `https://everything-savannah-risk-vitamin.trycloudflare.com`)
- **Proxy URL**: Full endpoint URL (e.g., `https://everything-savannah-risk-vitamin.trycloudflare.com/api/widget-settings`)

### Finding Your Current Tunnel URL

The current tunnel URL is automatically updated in `shopify.app.toml` when you run `shopify app dev`:

```toml
# shopify.app.toml
application_url = "https://your-current-tunnel-url.trycloudflare.com"
```

### Setting Up App Proxy in Shopify Partner Dashboard

The AI Sales Assistant widget needs to fetch settings from your app's API. This requires configuring an **App Proxy** in your Shopify Partner Dashboard.

#### Initial Setup:

1. **Go to Shopify Partner Dashboard**
   - Navigate to Apps → [Your App] → App setup

2. **Scroll to "App proxy" section**
   - Click "Set up app proxy"

3. **Configure the proxy settings**:
   - **Subpath prefix**: `apps`
   - **Subpath**: `ihear-ai` (or your preferred name)
   - **Proxy URL**: `https://your-tunnel-url.trycloudflare.com/api/widget-settings`

4. **Save the configuration**

#### Important: Update Proxy URL After Each Restart

⚠️ **CRITICAL WORKFLOW STEP**: Every time you restart `shopify app dev`, you must update the proxy URL in the Shopify Partner Dashboard because the tunnel URL changes.

**Steps to update after each restart:**

1. **Find your new tunnel URL**:
   - Check the `application_url` in `shopify.app.toml`
   - Or look for it in the terminal output when running `shopify app dev`

2. **Update the Proxy URL**:
   - Go to Partner Dashboard → Apps → [Your App] → App setup
   - Find the "App proxy" section
   - Update the **Proxy URL** to: `https://NEW-TUNNEL-URL.trycloudflare.com/api/widget-settings`
   - Save the changes

3. **Verify the update**:
   - Test the widget settings in your admin panel
   - The settings should save without "Failed to fetch" errors

### Why This Happens

- **Settings Storage**: Widget settings are stored in the database using the shop domain, so they persist across restarts
- **API Access**: The widget frontend needs to access the API endpoint through the app proxy
- **Tunnel URL Changes**: Shopify CLI generates a new tunnel URL each time for security
- **Manual Update Required**: The Partner Dashboard doesn't automatically update the proxy URL

### Production Deployment

In production, you'll have a **permanent domain**, eliminating the need for tunnel URL updates:

```toml
# Production shopify.app.toml
application_url = "https://your-app-domain.com"
```

The proxy URL becomes: `https://your-app-domain.com/api/widget-settings`

## 🎨 Installing the Widget

After the app is running:

1. **Install the app** in your development store (follow the CLI link)
2. **Go to theme customizer**: Online Store → Themes → Customize
3. **Add the widget**: Look for "AI Sales Assistant" in the app embeds section
4. **Configure the widget**: Use the admin panel at `/app/settings` to customize

## 🤖 AI Workflow Configuration

The app supports two different AI workflow modes that can be configured through the admin panel:

### Default Developer Workflow

**What it is**: A pre-configured AI assistant that works out-of-the-box
- ✅ **No setup required** - Works immediately after installation
- ✅ **Product integration** - Automatically knows about your store's products
- ✅ **Smart responses** - Handles product recommendations, pricing, shipping questions
- ✅ **Fallback protection** - Always provides helpful responses

**When to use**: Perfect for getting started quickly or if you don't need custom AI logic.

### Custom N8N Workflow

**What it is**: Integration with your own N8N workflow for advanced AI processing
- 🎯 **Full customization** - Create any AI logic you want
- 🔌 **External integrations** - Connect to OpenAI, Claude, databases, CRMs, etc.
- 🧠 **Advanced AI** - Use latest AI models and custom prompts
- 📊 **Analytics** - Track and analyze customer interactions

**When to use**: When you need custom AI logic, external integrations, or specific business requirements.

### How to Configure

1. **Access admin panel**: Go to your app settings at `/app/settings`
2. **Find AI Workflow Configuration section**
3. **Choose your workflow type**:
   - **"Use Developer's Default Workflow"** - Select this for the built-in AI assistant
   - **"Use My Custom N8N Workflow"** - Select this to use your own N8N setup
4. **If using custom**: Enter your N8N webhook URL (must be HTTPS)
5. **Save settings** - Changes take effect immediately

### Setting Up Custom N8N Workflow

If you choose the custom option:

1. **Set up N8N**: Follow the detailed guide in `N8N_SETUP.md`
2. **Create workflow**: Build your AI processing workflow
3. **Get webhook URL**: Copy the webhook URL from your N8N workflow
4. **Configure in admin**: Paste the URL in the "Custom N8N Webhook URL" field
5. **Test**: Send a test message through the widget to verify it works

### Per-Store Configuration

**Flexibility**: Each store can have its own configuration
- Store A can use the default workflow
- Store B can use custom N8N workflow #1  
- Store C can use custom N8N workflow #2
- All managed through their individual admin panels

**Environment Variables**: 
- `N8N_WEBHOOK_URL` in `.env` sets a global default
- Individual stores can override this through the admin panel
- Admin panel settings always take precedence

## 🔍 Troubleshooting

### Common Issues

1. **"Cannot read properties of undefined (reading 'findUnique')"**
   - Run `npx prisma generate` and `npx prisma migrate dev`

2. **"Extension draft update failed"**
   - Make sure you're in the correct directory
   - Restart the development server

3. **"Server IP address could not be found"**
   - The tunnel URL has changed, restart `shopify app dev`

4. **Widget not appearing on storefront**
   - Check if the app embed is enabled in theme customizer
   - Verify the widget is enabled in admin settings

5. **"Failed to fetch" errors when saving widget settings**
   - ⚠️ **Most common local development issue**
   - Check if you've updated the app proxy URL in Partner Dashboard
   - Verify the proxy URL matches your current tunnel URL from `shopify.app.toml`
   - Restart `shopify app dev` and update the proxy URL again

6. **Widget settings not loading on storefront**
   - Check browser developer console for CORS errors
   - Verify the app proxy is properly configured
   - Test the API endpoint directly: `https://your-tunnel-url.trycloudflare.com/api/widget-settings`

### Development Workflow Checklist

Every time you restart `shopify app dev`:

- [ ] Note the new tunnel URL from `shopify.app.toml`
- [ ] Update the app proxy URL in Shopify Partner Dashboard
- [ ] Test widget settings save functionality
- [ ] Verify widget loads properly on storefront

### Getting Help

- Check the main [README.md](README.md) for detailed documentation
- Open an issue on GitHub if you encounter problems
- Refer to [Shopify's documentation](https://shopify.dev/docs/apps) for app development help

## 🔒 Security Notes

- **Never commit** `.env` or `shopify.app.toml` files to version control
- **Keep your API keys secure** and don't share them publicly
- **Use environment variables** for all sensitive configuration
- **Regularly rotate** your API keys and secrets 