# Vercel Redeployment Steps - Fix Build Command Error

## Current Issue
```
Error: Command "prisma generate && npm run build" exited with 127
sh: line 1: prisma: command not found
```

## Root Cause
Vercel dashboard has the old build command cached or overridden. Even though `vercel.json` is now correct with `npx prisma generate`, Vercel is using an old cached configuration.

---

## ✅ Solution: Update Vercel Dashboard Settings

### Method 1: Clear Dashboard Override (RECOMMENDED)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your `shopibot` project

2. **Navigate to Settings**
   - Click: **Settings** (top navigation)
   - Click: **General** (left sidebar)
   - Scroll to: **Build & Development Settings**

3. **Clear the Build Command Override**
   - Find the **"Build Command"** field
   - If it has any value, **DELETE IT** (leave it blank)
   - This forces Vercel to use `vercel.json` configuration
   - Click **Save**

4. **Deploy Settings Should Look Like:**
   ```
   Framework Preset: Remix
   Build Command: [BLANK - uses vercel.json]
   Output Directory: [default]
   Install Command: npm install (or blank)
   Development Command: [default]
   ```

5. **Clear Cache and Redeploy**
   - Go to: **Deployments** tab
   - Click the **three dots (⋮)** on your latest deployment
   - Select: **"Redeploy"**
   - ✅ **IMPORTANT**: Uncheck "Use existing Build Cache"
   - Click: **"Redeploy"**

---

### Method 2: Set Correct Command Explicitly

If you prefer to override `vercel.json`:

1. **Go to**: Settings → General → Build & Development Settings
2. **Set Build Command to**:
   ```bash
   npx prisma generate && npm run build
   ```
3. **Save and redeploy** with cache cleared

---

## 🔍 Verify Configuration Files (Already Fixed)

All your local files are already correct:

### ✅ vercel.json
```json
{
  "buildCommand": "npx prisma generate && npm run build",
  "installCommand": "npm install",
  "framework": "remix"
}
```

### ✅ package.json
```json
{
  "scripts": {
    "build": "remix vite:build",
    "setup": "npx prisma generate && npx prisma migrate deploy"
  }
}
```

---

## 🎯 Quick Checklist

Before redeploying, ensure:

- [ ] Latest code is pushed to GitHub
- [ ] vercel.json has `npx prisma generate` (not `prisma generate`)
- [ ] Vercel dashboard Build Command is blank OR set to `npx prisma generate && npm run build`
- [ ] Redeploy with "Use existing Build Cache" **UNCHECKED**
- [ ] All environment variables are set (DATABASE_URL, SHOPIFY_API_KEY, etc.)

---

## 📝 Environment Variables Required

Make sure these are set in Vercel → Settings → Environment Variables:

```
DATABASE_URL=postgresql://...
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
SCOPES=write_products,read_customers,...
OPENAI_API_KEY=sk-...
N8N_WEBHOOK_URL=https://...
N8N_API_KEY=your_key
```

---

## 🐛 Troubleshooting

### If still getting "prisma: command not found":

1. **Check deployment logs** in Vercel dashboard
2. **Verify** the exact command being run (shown in logs)
3. **Ensure** `prisma` is in `dependencies` (NOT `devDependencies`)
   - In `package.json`, `"prisma": "^6.2.1"` should be under `dependencies` ✅

### If getting database connection errors:

1. **Check DATABASE_URL** format:
   ```
   postgresql://user:password@host:port/database?sslmode=require
   ```
2. **Verify** database is accessible from Vercel IPs
3. **Run migrations** manually if needed:
   ```bash
   npx prisma migrate deploy
   ```

---

## 🎉 Expected Success Output

After successful deployment, you should see in logs:

```
✓ Installing dependencies...
✓ Running "npx prisma generate"
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v6.2.1)

✓ Running "npm run build"
vite v6.3.5 building for production...
✓ built in 10.5s

Build Completed
```

---

## 📞 Still Having Issues?

If the above steps don't work:

1. **Delete and reconnect** your project in Vercel
2. **Import fresh** from GitHub repository
3. **Ensure** all environment variables are copied over
4. **Contact Vercel support** with deployment logs

---

Last updated: 2025-11-27
