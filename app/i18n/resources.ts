// Import all translation files for server-side bundling
import en from "../locales/en/common.json";
import es from "../locales/es/common.json";
import fr from "../locales/fr/common.json";
import de from "../locales/de/common.json";
import ja from "../locales/ja/common.json";
import it from "../locales/it/common.json";
import pt from "../locales/pt/common.json";
import zh from "../locales/zh/common.json";

// Export resources object for server-side i18next
export const resources = {
  en: { common: en },
  es: { common: es },
  fr: { common: fr },
  de: { common: de },
  ja: { common: ja },
  it: { common: it },
  pt: { common: pt },
  zh: { common: zh },
} as const;

export type Resources = typeof resources;
