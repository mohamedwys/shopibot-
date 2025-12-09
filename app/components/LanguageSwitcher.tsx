// app/components/LanguageSwitcher.tsx
import { Form, useLocation } from "@remix-run/react";

interface LanguageSwitcherProps {
  currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const location = useLocation();

  const languages = [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "es", label: "Español" },
    { code: "de", label: "Deutsch" },
    { code: "it", label: "Italiano" },
    { code: "pt", label: "Português" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文" },
  ];

  return (
    <Form method="post" action="/">
      <input type="hidden" name="returnTo" value={location.pathname} />
      <select
        name="locale"
        defaultValue={currentLocale}
        onChange={(e) => e.currentTarget.form?.submit()}
        className="text-sm p-1 border rounded bg-white shadow-sm"
      >
        {languages.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </Form>
  );
}