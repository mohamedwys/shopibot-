-- CreateTable
CREATE TABLE "WidgetSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "buttonText" TEXT NOT NULL DEFAULT 'Ask AI Assistant',
    "chatTitle" TEXT NOT NULL DEFAULT 'AI Sales Assistant',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hello! I''m your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?',
    "inputPlaceholder" TEXT NOT NULL DEFAULT 'Ask me anything about our products...',
    "primaryColor" TEXT NOT NULL DEFAULT '#007cba',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSettings_shop_key" ON "WidgetSettings"("shop");
