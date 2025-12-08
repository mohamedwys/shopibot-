import { RemixI18Next } from "remix-i18next/server";
import i18nConfig from "./index";
import { resources } from "./resources";
import { createCookie } from "@remix-run/node";

// --- Cookie to persist locale ---
export const localeCookie = createCookie("locale", {
  maxAge: 60 * 60 * 24 * 365, // 1 year
});

/**
 * Get locale from request
 * Priority:
 * 1️⃣ Cookie
 * 2️⃣ URL search param
 * 3️⃣ Default fallback
 */
export async function getLocaleFromRequest(request: Request): Promise<string> {
  try {
    console.log("[getLocaleFromRequest] Starting locale detection...");

    // --- 1️⃣ Check cookie ---
    const cookieHeader = request.headers.get("Cookie") ?? "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const [key, ...vals] = c.trim().split("=");
      if (!key) return;
      cookies[key] = decodeURIComponent(vals.join("="));
    });

    const cookieLocale = cookies["locale"];
    if (cookieLocale && i18nConfig.supportedLngs.includes(cookieLocale)) {
      console.log("[getLocaleFromRequest] ✅ Using locale from cookie:", cookieLocale);
      return cookieLocale;
    }

    // --- 2️⃣ Fallback to URL param ---
    const url = new URL(request.url);
    const localeParam = url.searchParams.get("locale");
    if (localeParam && i18nConfig.supportedLngs.includes(localeParam)) {
      console.log("[getLocaleFromRequest] ✅ Using locale from URL:", localeParam);
      return localeParam;
    }

    // --- 3️⃣ Fallback to default ---
    console.log("[getLocaleFromRequest] ⚠️ Using fallback locale:", i18nConfig.fallbackLng);
    return i18nConfig.fallbackLng;
  } catch (error) {
    console.error("[getLocaleFromRequest] ❌ Error detecting locale:", error);
    return i18nConfig.fallbackLng;
  }
}

// --- RemixI18Next server instance ---
const i18nServer = new RemixI18Next({
  detection: {
    supportedLanguages: i18nConfig.supportedLngs,
    fallbackLanguage: i18nConfig.fallbackLng,
    order: ["searchParams"], // cookies are handled manually
  },
  i18next: {
    ...i18nConfig,
    resources,
  },
});

export default i18nServer;
