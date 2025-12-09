// app/components/PolarisLanguageSwitcher.tsx
import { useState, useCallback } from "react";
import { Select } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

interface PolarisLanguageSwitcherProps {
  currentLocale: string;
}

/**
 * Polaris-styled language switcher for embedded app routes.
 * Uses Shopify Polaris Select component for consistent UI.
 */
export function PolarisLanguageSwitcher({ currentLocale }: PolarisLanguageSwitcherProps) {
  const [isChanging, setIsChanging] = useState(false);
  const { t } = useTranslation();

  const languages = [
    { label: "English", value: "en" },
    { label: "Français", value: "fr" },
    { label: "Español", value: "es" },
    { label: "Deutsch", value: "de" },
    { label: "Italiano", value: "it" },
    { label: "Português", value: "pt" },
    { label: "日本語", value: "ja" },
    { label: "中文", value: "zh" },
  ];

  const handleChange = useCallback(
    async (newLocale: string) => {
      if (newLocale === currentLocale || isChanging) return;

      setIsChanging(true);
      console.log(`[PolarisLanguageSwitcher] Changing locale to: ${newLocale}`);

      try {
        const response = await fetch("/api/set-locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: newLocale }),
          credentials: "include",
        });

        const result = await response.json();

        if (result.success) {
          console.log(`[PolarisLanguageSwitcher] ✅ Locale changed. Reloading...`);
          window.location.reload();
        } else {
          console.error(`[PolarisLanguageSwitcher] ❌ Failed:`, result.error);
          setIsChanging(false);
        }
      } catch (error) {
        console.error(`[PolarisLanguageSwitcher] ❌ Error:`, error);
        setIsChanging(false);
      }
    },
    [currentLocale, isChanging]
  );

  return (
    <Select
      label={t("common:language") || "Language"}
      options={languages}
      value={currentLocale}
      onChange={handleChange}
      disabled={isChanging}
      helpText={isChanging ? "Changing language..." : undefined}
    />
  );
}
