-- Add Quick Button Visibility Fields to WidgetSettings
-- Safe migration: All fields default to true for backward compatibility

-- Add visibility toggle for each quick button
ALTER TABLE "WidgetSettings" ADD COLUMN "bestSellersVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "newArrivalsVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "onSaleVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "recommendationsVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "shippingVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "returnsVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "trackOrderVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WidgetSettings" ADD COLUMN "helpVisible" BOOLEAN NOT NULL DEFAULT true;
