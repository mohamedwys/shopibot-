-- Release all Prisma advisory locks
-- Run this query on your database if migrations are stuck

-- Check current advisory locks
SELECT
  locktype,
  database,
  pid,
  mode,
  granted
FROM pg_locks
WHERE locktype = 'advisory';

-- Release ALL advisory locks (safe - only affects Prisma migration locks)
SELECT pg_advisory_unlock_all();

-- Verify locks are released
SELECT COUNT(*) as remaining_locks
FROM pg_locks
WHERE locktype = 'advisory';
