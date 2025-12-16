# 🚨 CRITICAL DEPLOYMENT FIX

## Issue: API Returning 500 Error

The diagnostic shows the API is returning 500 Internal Server Error. This is because the database schema update hasn't been applied to production.

## Solution: Run Database Migration

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Make sure these are set:
   - `DATABASE_URL` - Your Neon/Postgres database URL (with pooling)
   - `DIRECT_URL` - Your direct Neon connection URL (for migrations)

3. Go to **Deployments** → **Latest Deployment** → **...** menu → **Redeploy**

4. In the build logs, the migration should run automatically via the build command

### Option 2: Run Migration Manually

If you have access to the production database:

```bash
# Set environment variables
export DATABASE_URL="your-production-database-url"
export DIRECT_URL="your-direct-database-url"

# Run migration
npx prisma migrate deploy
```

### Option 3: Run via Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to your project
vercel link

# Run command in production environment
vercel env pull .env.production
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

## Verify Migration Success

After running the migration, test the API:

```javascript
fetch('https://shopibot.vercel.app/apps/sales-assistant-api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': 'galactiva.myshopify.com'
  },
  body: JSON.stringify({
    userMessage: 'test',
    context: { shopDomain: 'galactiva.myshopify.com' }
  })
})
.then(r => console.log('Status:', r.status))
.catch(console.error);
```

Should return **200** instead of 500.

## Alternative: Rollback Database Changes (Quick Fix)

If you can't run migrations immediately, you can temporarily rollback the schema changes:

1. Remove `workflowUsage` field from schema
2. Remove workflow tracking from code
3. Deploy without analytics enhancement
4. Add back later after migration

But the proper solution is to run the migration.
