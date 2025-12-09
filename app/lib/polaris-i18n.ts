// app/lib/polaris-i18n.ts
import type { SupportedLocale } from "../i18n/resources";

/**
 * Polaris i18n translations for supported locales.
 * Shopify Polaris provides translations for common UI elements.
 *
 * Import these dynamically based on locale to keep bundle size small.
 */

// Map our locale codes to Polaris locale codes
const POLARIS_LOCALE_MAP: Record<SupportedLocale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt-BR", // Polaris uses pt-BR for Portuguese
  ja: "ja",
  zh: "zh-CN", // Polaris uses zh-CN for Chinese
};

/**
 * Load Polaris translations for a given locale.
 * Returns undefined for English (default Polaris language).
 */
export async function loadPolarisTranslations(
  locale: SupportedLocale
): Promise<Record<string, any> | undefined> {
  // English is the default, no need to load translations
  if (locale === "en") {
    return undefined;
  }

  const polarisLocale = POLARIS_LOCALE_MAP[locale];

  try {
    // Dynamically import Polaris translations
    // Note: Polaris may not have translations for all languages
    // Fallback to English if translation file doesn't exist
    const translations = await import(
      `@shopify/polaris/locales/${polarisLocale}.json`
    );
    console.log(`[polaris-i18n] ✅ Loaded Polaris translations for: ${polarisLocale}`);
    return translations.default || translations;
  } catch (error) {
    console.warn(
      `[polaris-i18n] ⚠️ No Polaris translations found for ${polarisLocale}, using English fallback`
    );
    return undefined;
  }
}

/**
 * Get Polaris locale code from our locale code.
 */
export function getPolarisLocale(locale: SupportedLocale): string {
  return POLARIS_LOCALE_MAP[locale] || "en";
}
