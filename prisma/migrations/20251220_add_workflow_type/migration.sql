-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('DEFAULT', 'CUSTOM');

-- AlterTable
ALTER TABLE "WidgetSettings" ADD COLUMN "workflowType" "WorkflowType" NOT NULL DEFAULT 'DEFAULT';

-- Update existing rows: Set workflowType=CUSTOM for shops that have a custom webhookUrl
UPDATE "WidgetSettings"
SET "workflowType" = 'CUSTOM'
WHERE "webhookUrl" IS NOT NULL
  AND "webhookUrl" != ''
  AND "webhookUrl" != 'https://'
  AND "webhookUrl" != 'null'
  AND "webhookUrl" != 'undefined';
