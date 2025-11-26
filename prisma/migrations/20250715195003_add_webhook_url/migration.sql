-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WidgetSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "buttonText" TEXT NOT NULL DEFAULT 'Ask AI Assistant',
    "chatTitle" TEXT NOT NULL DEFAULT 'AI Sales Assistant',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hello! I''m your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?',
    "inputPlaceholder" TEXT NOT NULL DEFAULT 'Ask me anything about our products...',
    "primaryColor" TEXT NOT NULL DEFAULT '#ee5cee',
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WidgetSettings" ("buttonText", "chatTitle", "createdAt", "enabled", "id", "inputPlaceholder", "position", "primaryColor", "shop", "updatedAt", "welcomeMessage") SELECT "buttonText", "chatTitle", "createdAt", "enabled", "id", "inputPlaceholder", "position", "primaryColor", "shop", "updatedAt", "welcomeMessage" FROM "WidgetSettings";
DROP TABLE "WidgetSettings";
ALTER TABLE "new_WidgetSettings" RENAME TO "WidgetSettings";
CREATE UNIQUE INDEX "WidgetSettings_shop_key" ON "WidgetSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
