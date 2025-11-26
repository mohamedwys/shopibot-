# 🔐 Vercel Environment Variables Setup

## Required Environment Variables

Copy and paste these into your Vercel dashboard under **Settings → Environment Variables**.

### 1. Database Configuration

```env
DATABASE_URL=postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require
```

**Where to get it:**
- **Neon**: Dashboard → Connection String → Copy the one with pooling
- **Supabase**: Project Settings → Database → Connection pooling → Connection string
- **PlanetScale**: Database → Connect → Prisma → Copy connection string

⚠️ **Important**: Must include `?sslmode=require` at the end!

---

### 2. Shopify Configuration

```env
SHOPIFY_API_KEY=your_api_key_from_shopify_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_shopify_partner_dashboard
SCOPES=write_products,read_customers,write_customers
SHOPIFY_APP_URL=https://your-project-name.vercel.app
```

**Where to get Shopify credentials:**
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Click your app
3. Go to **App Setup** → **Client credentials**
4. Copy **Client ID** (this is your `SHOPIFY_API_KEY`)
5. Copy **Client secret** (this is your `SHOPIFY_API_SECRET`)

**For SHOPIFY_APP_URL:**
- Use your Vercel deployment URL: `https://your-project-name.vercel.app`
- No trailing slash!

---

### 3. OpenAI Configuration (Optional - for AI features)

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxx
```

**Where to get it:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

**Cost**: ~$0.20/month for typical usage (1000 products + 10,000 queries)

⚠️ **Skip this if you don't want AI features** - The app will work without it using basic keyword search.

---

### 4. N8N Integration (Optional)

```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/xxxxx
N8N_API_KEY=your_n8n_api_key
```

**Where to get it:**
- From your N8N workflow webhook node
- Only needed if you're using custom N8N workflows

⚠️ **Skip this if you don't use N8N** - The app has built-in AI fallback.

---

### 5. Widget Configuration (Optional)

```env
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=sales-assistant-widget
```

**Default value**: `sales-assistant-widget`

⚠️ **Only change if you modified the widget ID** in your theme extension.

---

## 🚀 How to Add in Vercel

### Method 1: Vercel Dashboard (Easiest)

1. Go to your project in Vercel
2. Click **Settings**
3. Click **Environment Variables** in the left sidebar
4. For each variable:
   - Enter the **Key** (e.g., `DATABASE_URL`)
   - Enter the **Value** (the actual connection string)
   - Select which environments: **Production**, **Preview**, **Development** (select all)
   - Click **Save**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Add environment variables
vercel env add DATABASE_URL production
# Paste your value when prompted

# Repeat for all variables
vercel env add SHOPIFY_API_KEY production
vercel env add SHOPIFY_API_SECRET production
# ... etc
```

### Method 3: Bulk Import (.env file)

```bash
# Create .env.production file locally
cat > .env.production << 'EOF'
DATABASE_URL=postgresql://...
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
SHOPIFY_APP_URL=https://your-app.vercel.app
SCOPES=write_products,read_customers,write_customers
OPENAI_API_KEY=sk-...
EOF

# Import to Vercel
vercel env import .env.production production
```

---

## ✅ Verification Checklist

Before redeploying, verify:

- [ ] `DATABASE_URL` is set and includes `?sslmode=require`
- [ ] `SHOPIFY_API_KEY` is set (from Shopify Partner Dashboard)
- [ ] `SHOPIFY_API_SECRET` is set (from Shopify Partner Dashboard)
- [ ] `SHOPIFY_APP_URL` matches your Vercel URL
- [ ] `SCOPES` includes necessary permissions
- [ ] All variables are set for **Production** environment
- [ ] No spaces or quotes around values

---

## 🧪 Test Environment Variables

After setting variables, test them:

```bash
# Pull environment variables locally
vercel env pull .env

# Check if they're correct
cat .env

# Test database connection
npx prisma db pull
```

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** to Git
   - Already in `.gitignore`, but double-check

2. **Use different values for different environments**
   - Development database ≠ Production database
   - Test API keys for development

3. **Rotate secrets regularly**
   - Change API keys every 6 months
   - Update in Vercel when you rotate

4. **Use environment-specific values**
   - Production: Real database, real API keys
   - Preview: Test database, test API keys
   - Development: Local database, dev API keys

---

## 🐛 Troubleshooting

### "Environment variable not found"
- Make sure you selected the correct environment (Production/Preview/Development)
- Redeploy after adding variables

### "Database connection failed"
- Verify `DATABASE_URL` format
- Test connection locally: `npx prisma db pull`
- Check if database is accessible from Vercel's IP

### "Shopify authentication failed"
- Double-check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
- Make sure they match your Shopify Partner Dashboard

### "OpenAI API error"
- Verify your API key is active
- Check if you have credits/billing set up

---

## 📋 Complete Example

Here's a complete example with all variables (replace with your actual values):

```env
# Database
DATABASE_URL=postgresql://neondb_owner:abc123xyz@ep-cool-sound-123.us-east-2.aws.neon.tech/neondb?sslmode=require

# Shopify
SHOPIFY_API_KEY=1a2b3c4d5e6f7g8h9i0j
SHOPIFY_API_SECRET=shpss_1234567890abcdefghijklmnopqrstuvwxyz
SCOPES=write_products,read_customers,write_customers
SHOPIFY_APP_URL=https://shopibot-ai.vercel.app

# OpenAI (Optional)
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890

# N8N (Optional)
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/abc123
N8N_API_KEY=n8n_api_1234567890

# Widget (Optional)
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=sales-assistant-widget
```

---

## 🆘 Need Help?

If you're stuck:

1. Check the [VERCEL_FIX.md](./VERCEL_FIX.md) for deployment troubleshooting
2. View Vercel function logs for specific errors
3. Test database connection locally before deploying

---

**Next Step**: After setting all variables, follow the [VERCEL_FIX.md](./VERCEL_FIX.md) guide to complete the deployment! 🚀
