// app/components/LanguageSwitcher.tsx
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

      // IMPORTANT: include where the user should be returned after changing language
      // Use pathname + search so we stay on the same route inside the app.
      const returnTo = window.location.pathname + window.location.search;
      formData.append("returnTo", returnTo);

      // Submit to root action explicitly
      submit(formData, { method: "post", action: "/" });

      // Update client-side i18n immediately for smoother UX
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
