# Database Migration Guide

## ⚠️ CRITICAL: Missing Database Column

Your analytics dashboard is showing zeros because the `workflowUsage` column is missing from the `ChatAnalytics` table in your production database.

## Error Message You're Seeing

```
The column `ChatAnalytics.workflowUsage` does not exist in the current database.
```

## Quick Fix

You need to run a database migration to add this column. Choose one of the methods below:

---

## Method 1: Using Prisma Migrate (Recommended)

If you have access to your production server's shell:

```bash
# Navigate to your project directory
cd /path/to/shopibot

# Run the migration
npx prisma migrate deploy
```

This will apply all pending migrations, including the `workflowUsage` column.

---

## Method 2: Using the Node.js Script

If Prisma migrate doesn't work (network issues, etc.):

```bash
# Run the custom migration script
node scripts/add-workflow-column.mjs
```

This script:
- ✅ Connects directly to your database
- ✅ Checks if the column already exists
- ✅ Adds the column if missing
- ✅ Safe to run multiple times (idempotent)

---

## Method 3: Direct SQL (If you have database access)

If you can access your PostgreSQL database directly:

```sql
-- Check if column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ChatAnalytics'
AND column_name = 'workflowUsage';

-- If it doesn't exist, add it:
ALTER TABLE "ChatAnalytics"
ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}';
```

Or run the SQL file:

```bash
psql $DATABASE_URL < scripts/add-workflow-usage-column.sql
```

---

## Method 4: Using Your Hosting Platform

### For Vercel:
1. Go to your project settings
2. Navigate to the PostgreSQL database
3. Open the SQL editor
4. Run this query:

```sql
ALTER TABLE "ChatAnalytics"
ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}';
```

### For Render/Railway/Other:
1. Access your database console
2. Run the SQL query above

---

## Verification

After running the migration, verify it worked:

```bash
# Using Prisma Studio
npx prisma studio

# Or check via SQL
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ChatAnalytics' AND column_name = 'workflowUsage';"
```

You should see the `workflowUsage` column listed.

---

## What This Column Does

The `workflowUsage` column tracks whether users are using:
- **Default workflow**: The built-in N8N workflow
- **Custom workflow**: A custom N8N webhook URL

This helps you understand which workflow type is being used more in your analytics dashboard.

---

## After Migration

Once the column is added:

1. **Restart your application** (if needed)
2. **Visit your analytics dashboard**: `/app/analytics`
3. **Send a few test messages** via the widget
4. **Check the dashboard again** - data should now appear!

---

## Troubleshooting

### If you see "Prisma engines not found" errors:

```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy
```

### If the Node.js script fails:

Make sure you have the `pg` package installed:

```bash
npm install pg
```

### If you don't have DATABASE_URL:

The script needs either `DATABASE_URL` or `DIRECT_URL` environment variable. Check your `.env` file or hosting platform settings.

---

## Need Help?

1. Check the logs for specific error messages
2. Verify your database connection string is correct
3. Ensure you have permissions to alter tables
4. Try the direct SQL method if all else fails

---

## Files Included

- `scripts/add-workflow-column.mjs` - Node.js migration script
- `scripts/add-workflow-usage-column.sql` - Raw SQL migration
- `scripts/run-workflow-migration.js` - Alternative Prisma-based script
- `prisma/migrations/20251216190500_add_workflow_usage_tracking/` - Prisma migration

Choose whichever method works best for your environment!
