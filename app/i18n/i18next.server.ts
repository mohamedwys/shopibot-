import { RemixI18Next } from "remix-i18next/server";
import i18nConfig from "./index";
import { resources } from "./resources";

// Create RemixI18Next instance with bundled resources and simplified detection
const i18nServer = new RemixI18Next({
  detection: {
    supportedLanguages: i18nConfig.supportedLngs,
    fallbackLanguage: i18nConfig.fallbackLng,
    // Disable cookie detection to avoid cookie.parse issues
    // We'll handle this manually in loaders
    order: ["searchParams"],
  },
  // i18next configuration
  i18next: {
    ...i18nConfig,
    // Provide resources directly for serverless compatibility
    resources,
  },
});

/**
 * Get locale from request with manual cookie parsing
 * Bypasses remix-i18next cookie detection to avoid dependency issues
 */
export async function getLocaleFromRequest(request: Request): Promise<string> {
  try {
    console.log('[getLocaleFromRequest] Starting locale detection...');

    // Manual cookie parsing (check FIRST for user preference)
    const cookieHeader = request.headers.get("Cookie");
    console.log('[getLocaleFromRequest] Cookie header:', cookieHeader);

    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      console.log('[getLocaleFromRequest] Parsed cookies:', cookies);

      const localeCookie = cookies["locale"];
      if (localeCookie && i18nConfig.supportedLngs.includes(localeCookie)) {
        console.log('[getLocaleFromRequest] ✅ Found locale in cookie:', localeCookie);
        return localeCookie;
      } else {
        console.log('[getLocaleFromRequest] No valid locale cookie found');
      }
    }

    // Try to get from URL searchParams as fallback (only for first visit)
    const url = new URL(request.url);
    const localeParam = url.searchParams.get("locale");
    console.log('[getLocaleFromRequest] URL locale parameter:', localeParam);

    if (localeParam && i18nConfig.supportedLngs.includes(localeParam)) {
      console.log('[getLocaleFromRequest] ✅ Using locale from URL:', localeParam);
      return localeParam;
    }

    // Fallback to default
    console.log('[getLocaleFromRequest] ⚠️ Using fallback locale:', i18nConfig.fallbackLng);
    return i18nConfig.fallbackLng;
  } catch (error) {
    console.error("[getLocaleFromRequest] ❌ Error getting locale:", error);
    return i18nConfig.fallbackLng;
  }
}

export default i18nServer;
