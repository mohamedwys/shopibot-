// app/components/LanguageSwitcher.tsx
import { Form } from "@remix-run/react";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

interface LanguageSwitcherProps {
  currentLocale?: string;
}

export function LanguageSwitcher({ currentLocale = "en" }: LanguageSwitcherProps) {
  return (
    <Form method="post" action="/set-locale">
      <label htmlFor="locale-select" className="sr-only">Select Language</label>
      <select
        id="locale-select"
        name="locale"
        defaultValue={currentLocale}
        onChange={(e) => e.currentTarget.form?.submit()}
        className="
          bg-white
          border
          border-gray-300
          rounded
          px-3
          py-1
          text-sm
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-blue-500
          shadow-sm
        "
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </Form>
  );
}
