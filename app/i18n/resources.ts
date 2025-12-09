// app/i18n/resources.ts

import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";
import frCommon from "./locales/fr/common.json";
import deCommon from "./locales/de/common.json";
import jaCommon from "./locales/ja/common.json";
import itCommon from "./locales/it/common.json";
import ptCommon from "./locales/pt/common.json";
import zhCommon from "./locales/zh/common.json";

export type SupportedLocale = "en" | "es" | "fr" | "de" | "ja" | "it" | "pt" | "zh";
export type DefaultNamespace = "common";

export const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
  fr: { common: frCommon },
  de: { common: deCommon },
  ja: { common: jaCommon },
  it: { common: itCommon },
  pt: { common: ptCommon },
  zh: { common: zhCommon },
} as const;

// Optional: Log in dev only
if (process.env.NODE_ENV === "development") {
  console.log("✅ [i18n/resources] Loaded locales:", Object.keys(resources));
}