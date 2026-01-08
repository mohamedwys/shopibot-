-- AlterTable
ALTER TABLE "WidgetSettings" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'BASIC',
ADD COLUMN "openaiApiKey" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_shop_sessionId_idx" ON "Conversation"("shop", "sessionId");

-- CreateIndex
CREATE INDEX "Conversation_shop_timestamp_idx" ON "Conversation"("shop", "timestamp");
