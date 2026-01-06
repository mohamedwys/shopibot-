-- Add workflowUsage column to ChatAnalytics table
-- This migration adds workflow usage tracking

-- Check if column exists, and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ChatAnalytics'
        AND column_name = 'workflowUsage'
    ) THEN
        ALTER TABLE "ChatAnalytics"
        ADD COLUMN "workflowUsage" TEXT NOT NULL DEFAULT '{}';

        RAISE NOTICE 'Column workflowUsage added successfully';
    ELSE
        RAISE NOTICE 'Column workflowUsage already exists';
    END IF;
END $$;
