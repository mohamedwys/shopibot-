# 🔧 Fix Vercel Deployment Error

You're getting a `500: FUNCTION_INVOCATION_FAILED` error. This is a common issue with Remix apps on Vercel. Let's fix it step by step.

## 🎯 Root Causes

The error happens because:
1. ❌ **Missing DATABASE_URL** - Prisma can't connect to the database
2. ❌ **Missing environment variables** - Shopify credentials not set
3. ❌ **Prisma client not generated** - Build didn't generate Prisma properly
4. ❌ **Wrong build configuration** - Default Remix build doesn't work on Vercel

## ✅ Solution: Follow These Steps

### Step 1: Set Up Database (If Not Done)

If you haven't set up a database yet, use **Neon** (easiest):

1. Go to https://neon.tech
2. Sign up and create a new project
3. Copy your connection string (looks like this):
   ```
   postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Configure Environment Variables in Vercel

**CRITICAL**: You must set these environment variables in Vercel:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables (one by one):

```env
# ⚠️ REQUIRED - Your Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# ⚠️ REQUIRED - Shopify Credentials
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SCOPES=write_products,read_customers,write_customers

# ⚠️ REQUIRED - Your Vercel App URL
SHOPIFY_APP_URL=https://your-app.vercel.app

# 🔐 OPTIONAL - OpenAI for AI features
OPENAI_API_KEY=sk-your-openai-key

# 📞 OPTIONAL - N8N Integration
N8N_WEBHOOK_URL=your_n8n_webhook_url
N8N_API_KEY=your_n8n_api_key

# 🏪 OPTIONAL - Widget ID
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=your_widget_id
```

**Important Notes:**
- Set these for **Production**, **Preview**, and **Development** environments
- Make sure there are no spaces or quotes around values
- The `DATABASE_URL` must include `?sslmode=require` at the end

### Step 3: Run Database Migration

After setting environment variables, you need to run migrations:

**Option A: Use Vercel CLI (Recommended)**
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Pull environment variables
vercel env pull .env

# Run migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

**Option B: Use Local Terminal with Database URL**
```bash
# Set your database URL temporarily
export DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Run migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Step 4: Update Vercel Build Settings

1. Go to your Vercel project dashboard
2. Click **Settings** → **General**
3. Scroll to **Build & Development Settings**
4. Set these values:

```
Framework Preset: Remix
Build Command: prisma generate && npm run build
Output Directory: (leave default)
Install Command: npm install
```

### Step 5: Redeploy

After completing steps 1-4:

1. Go to **Deployments** tab in Vercel
2. Click the **•••** menu on the latest deployment
3. Click **Redeploy**
4. Select **Use existing Build Cache: NO** (important!)
5. Click **Redeploy**

OR push a new commit:
```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push
```

---

## 🔍 Verify Deployment

Once redeployed, check:

1. **Deployment Logs**: Look for errors in the build/function logs
2. **Function Logs**: Go to Deployments → Click on deployment → View Function Logs
3. **Test the API**: Visit `https://your-app.vercel.app/api/health` (if you have a health endpoint)

---

## 🐛 Common Errors & Fixes

### Error: "Can't reach database server"
**Fix**: Your DATABASE_URL is wrong or database is not accessible
- Verify the connection string in Vercel environment variables
- Make sure it includes `?sslmode=require` for Neon/Supabase
- Test connection locally first

### Error: "Prisma Client could not locate the schema"
**Fix**: Prisma didn't generate during build
- Make sure build command includes `prisma generate`
- Clear build cache and redeploy

### Error: "Missing environment variable"
**Fix**: Environment variables not set in Vercel
- Double-check all required variables are set
- Make sure they're set for all environments (Production/Preview/Development)

### Error: "Function timeout"
**Fix**: Function taking too long to execute
- Increase maxDuration in vercel.json (already set to 30s)
- Optimize database queries
- Check if N8N webhook is responding slowly

---

## 📋 Quick Checklist

Before redeploying, verify:

- [ ] Database created and accessible (Neon/Supabase/PlanetScale)
- [ ] All environment variables set in Vercel dashboard
- [ ] `DATABASE_URL` includes `?sslmode=require`
- [ ] Build command set to `prisma generate && npm run build`
- [ ] Database migration run with `npx prisma migrate deploy`
- [ ] Clear build cache when redeploying

---

## 🎯 Next Steps After Fix

Once your app deploys successfully:

1. **Update Shopify Partner Dashboard**:
   - App URL: `https://your-app.vercel.app`
   - Allowed redirection URLs: `https://your-app.vercel.app/auth/callback`
   - Application proxy: `https://your-app.vercel.app/apps/sales-assistant-api`

2. **Test Your Chatbot**:
   - Install the app on a test store
   - Open your store theme
   - Check if the chatbot widget appears

3. **Generate Product Embeddings** (Optional - for AI features):
   ```bash
   npm run generate-embeddings
   ```

---

## 💡 Pro Tips

1. **Use Vercel CLI for faster debugging**:
   ```bash
   vercel logs --follow
   ```

2. **Test locally before deploying**:
   ```bash
   vercel env pull .env
   npm run build
   npm start
   ```

3. **Monitor function performance**:
   - Check function execution time in Vercel dashboard
   - Optimize slow database queries

---

## 🆘 Still Having Issues?

If you're still getting errors:

1. **Check Function Logs**:
   - Go to Vercel Dashboard → Deployments → Click deployment → View Function Logs
   - Look for specific error messages

2. **Verify Database Connection**:
   ```bash
   # Test database connection locally
   export DATABASE_URL="your_connection_string"
   npx prisma db pull
   ```

3. **Common Issues**:
   - Missing `SHOPIFY_API_SECRET` (required for authentication)
   - Wrong database URL format
   - Prisma schema not compatible with production database

Let me know what specific error you see in the function logs, and I'll help you fix it! 🚀
