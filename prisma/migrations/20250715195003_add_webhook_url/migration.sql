-- AlterTable - Add webhookUrl column
ALTER TABLE "WidgetSettings" ADD COLUMN "webhookUrl" TEXT;

-- Update default primaryColor (optional - for existing records)
UPDATE "WidgetSettings" SET "primaryColor" = '#ee5cee' WHERE "primaryColor" = '#007cba';
