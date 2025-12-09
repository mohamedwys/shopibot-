// app/components/LanguageSwitcher.tsx
import { useState } from "react";
import { useRevalidator } from "@remix-run/react";

interface LanguageSwitcherProps {
  currentLocale: string;
}

/**
 * Client-side language switcher that works in Shopify embedded apps.
 * Uses fetch API to avoid redirect issues in iframe.
 */
export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const [isChanging, setIsChanging] = useState(false);
  const revalidator = useRevalidator();

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

  const handleLocaleChange = async (newLocale: string) => {
    if (newLocale === currentLocale || isChanging) return;

    setIsChanging(true);
    console.log(`[LanguageSwitcher] Changing locale to: ${newLocale}`);

    try {
      const response = await fetch("/set-locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
        credentials: "include", // ✅ Important for cookies in iframe
      });

      const result = await response.json();

      if (result.success) {
        console.log(`[LanguageSwitcher] ✅ Locale changed successfully. Reloading...`);

        // Option 1: Reload the page to apply new locale
        window.location.reload();

        // Option 2: Use revalidator (doesn't reload page, but may not update all translations)
        // revalidator.revalidate();
      } else {
        console.error(`[LanguageSwitcher] ❌ Failed to change locale:`, result.error);
        alert(`Failed to change language: ${result.error}`);
        setIsChanging(false);
      }
    } catch (error) {
      console.error(`[LanguageSwitcher] ❌ Error changing locale:`, error);
      alert("Failed to change language. Please try again.");
      setIsChanging(false);
    }
  };

  return (
    <select
      value={currentLocale}
      onChange={(e) => handleLocaleChange(e.target.value)}
      disabled={isChanging}
      className="text-sm p-1 border rounded bg-white shadow-sm"
      style={{
        maxWidth: "140px",
        cursor: isChanging ? "wait" : "pointer",
        opacity: isChanging ? 0.6 : 1
      }}
    >
      {languages.map(({ code, label }) => (
        <option key={code} value={code}>
          {isChanging && code === currentLocale ? "⏳ " : ""}{label}
        </option>
      ))}
    </select>
  );
}