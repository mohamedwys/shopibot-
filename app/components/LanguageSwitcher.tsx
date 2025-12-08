import { Select } from "@shopify/polaris";
import { useSubmit } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const { i18n, t } = useTranslation();
  const submit = useSubmit();

  const handleChange = useCallback(
    (value: string) => {
      const formData = new FormData();
      formData.append("locale", value);

      // 🔥 FIX: force POST to root action (root.tsx)
      submit(formData, { method: "post", action: "/" });

      // Optional: instant UI update
      i18n.changeLanguage(value);
    },
    [i18n, submit]
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
