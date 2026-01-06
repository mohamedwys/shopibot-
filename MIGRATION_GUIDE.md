# Database Migration Required

## ⚠️ Issue: Missing `workflowUsage` Column

Your analytics dashboard is failing because the `workflowUsage` column doesn't exist in your production database's `ChatAnalytics` table.

**Error you're seeing:**
```
The column `ChatAnalytics.workflowUsage` does not exist in the current database.
```

## ✅ Solution: Run Prisma Migration

The migration file already exists at:
```
prisma/migrations/20251216190500_add_workflow_usage_tracking/migration.sql
```

You just need to apply it to your production database.

---

## How to Run the Migration

### On Your Production Server:

```bash
# Navigate to your project directory
cd /path/to/shopibot

# Run pending migrations
npx prisma migrate deploy
```

This will:
- ✅ Detect the pending `add_workflow_usage_tracking` migration
- ✅ Add the `workflowUsage` column to `ChatAnalytics` table
- ✅ Set default value of `'{}'` for existing records

---

## Platform-Specific Instructions

### Vercel

**Option 1 - Using Vercel CLI:**
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

**Option 2 - Build Hook:**
Add to your `package.json`:
```json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && remix vite:build"
  }
}
```

### Render / Railway

SSH into your service and run:
```bash
npx prisma migrate deploy
```

Or add as a build command:
```bash
npx prisma migrate deploy && npm run build
```

### Direct Database Access

If you have direct PostgreSQL access:
```sql
ALTER TABLE "ChatAnalytics"
ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}';
```

---

## Verify Migration Success

After running the migration:

```bash
# Check migration status
npx prisma migrate status

# You should see: "Database schema is up to date!"
```

Or query directly:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ChatAnalytics'
AND column_name = 'workflowUsage';
```

---

## After Migration

1. **No restart needed** - Changes take effect immediately
2. **Visit** `/app/analytics`
3. **Send a test message** via the widget
4. **Refresh dashboard** - Data should now appear!

---

## Troubleshooting

### "Cannot find Prisma engines"

```bash
npx prisma generate
npx prisma migrate deploy
```

### Network Issues

If you get 403 errors downloading Prisma engines:
```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy
```

### Still Not Working?

Check the logs for specific errors and ensure:
- Database connection string is correct
- You have ALTER TABLE permissions
- The migration hasn't already been applied (`npx prisma migrate status`)

---

## What This Migration Does

Adds workflow usage tracking to distinguish between:
- **Default workflow** - Built-in N8N workflow
- **Custom workflow** - User-configured N8N webhook

This data appears in your analytics dashboard to show which workflow type is being used more.
