# ⚡ Deploy to Vercel

Deploy your ShopiBot to Vercel with serverless functions.

---

## ⚠️ Deployment Error? See Troubleshooting Guide

If you're getting a **500 error** or **FUNCTION_INVOCATION_FAILED** after deploying, check:
- **[VERCEL_FIX.md](./VERCEL_FIX.md)** - Complete troubleshooting guide
- **[VERCEL_ENVIRONMENT_VARIABLES.md](./VERCEL_ENVIRONMENT_VARIABLES.md)** - Environment variable setup

---

## 🎯 Prerequisites

- [ ] Vercel account ([vercel.com](https://vercel.com))
- [ ] Code pushed to GitHub
- [ ] Shopify API Key
- [ ] OpenAI API Key
- [ ] External database (Neon, Supabase, or PlanetScale)

⚠️ **Important:** Vercel doesn't provide databases. You'll need an external PostgreSQL database.

---

## 🗄️ Step 1: Set Up Database

Choose one of these free PostgreSQL providers:

### **Option A: Neon (Recommended)**

1. Go to [neon.tech](https://neon.tech)
2. Sign up and create project
3. Copy connection string:
   ```
   postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```

### **Option B: Supabase**

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy connection string (use "Connection pooling" URL)

### **Option C: PlanetScale**

1. Go to [planetscale.com](https://planetscale.com)
2. Create database
3. Create password
4. Copy connection string

---

## 🚀 Step 2: Deploy to Vercel

### **Method 1: Vercel Dashboard (Easiest)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Remix
4. Click "Deploy"

### **Method 2: Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

---

## ⚙️ Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```env
# Shopify Configuration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_SALES_ASSISTANT_WIDGET_ID=your_widget_id

# Database (from Neon/Supabase/PlanetScale)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# N8N (optional)
N8N_WEBHOOK_URL=your_n8n_url
N8N_API_KEY=your_n8n_key

# Node Environment
NODE_ENV=production
```

Click "Save"

---

## 🔧 Step 4: Update Prisma Schema

Ensure `prisma/schema.prisma` uses PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 🗃️ Step 5: Run Database Migrations

**Important:** Run migrations manually before deploying:

```bash
# Set DATABASE_URL to your Neon/Supabase URL
export DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

---

## 📱 Step 6: Update Shopify Partner Dashboard

Get your Vercel URL (e.g., `https://shopibot.vercel.app`) and update:

**App URL:**
```
https://shopibot.vercel.app
```

**Allowed Redirection URLs:**
```
https://shopibot.vercel.app/auth/callback
https://shopibot.vercel.app/auth/shopify/callback
https://shopibot.vercel.app/api/auth/callback
```

**App Proxy:**
- Subpath prefix: `apps`
- Subpath: `widget-settings`
- Proxy URL: `https://shopibot.vercel.app/api/widget-settings`

---

## 🎨 Step 7: Configure Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Add your domain: `shopibot.yourdomain.com`
3. Add CNAME record in your DNS:
   ```
   CNAME shopibot -> cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-10 minutes)
5. Update Shopify Partner Dashboard with new domain

---

## 🔄 Automatic Deployments

Vercel automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push
```

Vercel will:
1. Detect push
2. Build app
3. Deploy to production
4. Update URL

Preview URLs for branches:
- `main` → Production
- `feature-branch` → Preview URL

---

## 📊 Monitor Deployment

**View Logs:**
- Vercel Dashboard → Deployments → Click deployment → Logs

**Check Build Status:**
- Green checkmark = Success
- Red X = Failed (click for logs)

---

## ⚡ Vercel vs Railway Comparison

| Feature | Vercel | Railway |
|---------|--------|---------|
| **Deployment** | Serverless | Container |
| **Database** | External (Neon) | Built-in PostgreSQL |
| **Free Tier** | 100GB bandwidth/month | $5 credit/month |
| **Build Time** | ~2 minutes | ~3 minutes |
| **Auto-deploy** | ✅ Yes | ✅ Yes |
| **Custom Domain** | ✅ Free | ✅ Free |
| **Edge Network** | ✅ Yes (global) | ❌ No |
| **Setup Complexity** | Medium (need external DB) | Easy (all-in-one) |

**Recommendation:**
- **Vercel**: If you want global edge network and serverless
- **Railway**: If you want simplicity (includes database)

---

## 🐛 Troubleshooting

### **Issue: "DATABASE_URL is not defined"**

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add `DATABASE_URL` with your Neon/Supabase connection string
3. Redeploy

### **Issue: "Prisma Client not generated"**

**Solution:**
Add to `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate",
  "vercel-build": "prisma generate && prisma migrate deploy && remix vite:build"
}
```

### **Issue: Migration errors**

**Solution:**
Run migrations manually:
```bash
DATABASE_URL="your_database_url" npx prisma migrate deploy
```

### **Issue: App proxy not working**

**Solution:**
1. Verify Vercel deployment is successful
2. Check URL in Shopify Partner Dashboard
3. Test endpoint:
   ```bash
   curl https://shopibot.vercel.app/api/widget-settings
   ```

---

## 💰 Cost Estimate

**Vercel:**
- Hobby (Free): 100GB bandwidth, unlimited sites
- Pro ($20/month): More bandwidth, analytics

**Database (Neon):**
- Free tier: 512MB storage, 1 project
- Pro ($19/month): More storage, branches

**Total:**
- Free setup: $0/month
- Production setup: $0-40/month

---

## 🎯 Quick Checklist

- [ ] Create Neon/Supabase database
- [ ] Get DATABASE_URL connection string
- [ ] Push code to GitHub
- [ ] Deploy to Vercel from GitHub
- [ ] Add environment variables in Vercel
- [ ] Run `prisma migrate deploy` locally
- [ ] Update Shopify Partner Dashboard URLs
- [ ] Test app installation
- [ ] Test chat widget
- [ ] Generate embeddings (optional)

---

## 🚀 Alternative: Vercel + Neon Quick Start

**The absolute fastest way:**

1. **Create Neon Database:**
   ```bash
   # Go to neon.tech, create project, copy connection string
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   # Follow prompts
   ```

3. **Add Environment Variables:**
   ```bash
   vercel env add DATABASE_URL
   # Paste Neon connection string

   vercel env add SHOPIFY_API_KEY
   vercel env add OPENAI_API_KEY
   vercel env add SHOPIFY_SALES_ASSISTANT_WIDGET_ID
   ```

4. **Run Migrations:**
   ```bash
   DATABASE_URL="paste_neon_url" npx prisma migrate deploy
   ```

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

6. **Update Shopify Partner Dashboard** (see Step 6)

Done! ⚡

---

## 📚 Additional Resources

- [Vercel Docs](https://vercel.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Remix on Vercel](https://vercel.com/docs/frameworks/remix)
- [Prisma with Neon](https://neon.tech/docs/guides/prisma)

---

## 🔮 Next Steps

After deployment:
- [ ] Monitor Vercel analytics
- [ ] Set up error tracking (Sentry)
- [ ] Configure alerts
- [ ] Generate product embeddings
- [ ] Test with real customers

---

**Deployment Time:** ~10 minutes
**Difficulty:** Medium 🟡 (requires external database)
**Result:** Serverless global deployment! 🌍

---

**Need Help?**
- Check Vercel deployment logs
- Review Neon connection string
- Verify environment variables
- Test database connectivity
