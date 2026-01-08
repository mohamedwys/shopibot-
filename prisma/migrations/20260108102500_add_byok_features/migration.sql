-- AlterTable
ALTER TABLE "WidgetSettings" ADD COLUMN "apiKeyLastTested" TIMESTAMP(3),
ADD COLUMN "apiKeyLastUpdated" TIMESTAMP(3),
ADD COLUMN "apiKeyStatus" TEXT;

-- CreateTable
CREATE TABLE "ByokUsage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalApiCalls" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL DEFAULT 'BYOK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ByokUsage_shop_date_key" ON "ByokUsage"("shop", "date");

-- CreateIndex
CREATE INDEX "ByokUsage_shop_date_idx" ON "ByokUsage"("shop", "date");

-- CreateIndex
CREATE INDEX "ByokUsage_date_idx" ON "ByokUsage"("date");
