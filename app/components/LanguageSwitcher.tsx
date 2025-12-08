import { Select } from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const { t, i18n } = useTranslation();

  const handleChange = useCallback(
    (value: string) => {
      // Update i18n immediately on the client
      i18n.changeLanguage(value);

      // Save locale in cookie for server
      document.cookie = `locale=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;

      // Reload the page so server renders in new locale
      window.location.reload();
    },
    [i18n]
  );

  const languageOptions = [
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "Français", value: "fr" },
    { label: "Deutsch", value: "de" },
    { label: "日本語", value: "ja" },
    { label: "Italiano", value: "it" },
    { label: "Português", value: "pt" },
    { label: "中文", value: "zh" },
  ];

  return (
    <Select
      label={t("common.language")}
      options={languageOptions}
      value={locale}
      onChange={handleChange}
      labelHidden
    />
  );
}
