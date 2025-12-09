// app/i18n/i18next.server.ts

import { createCookie } from "@remix-run/node";
import i18n from "i18next";
import i18nConfig from "./index";
import { resources } from "./resources";
import type { SupportedLocale, DefaultNamespace } from "./resources";

// 👇 Export a server-side i18n instance
export const i18nServer = i18n.createInstance();

i18nServer.init({
  ...i18nConfig,
  resources,
  fallbackLng: i18nConfig.fallbackLng,
  lng: i18nConfig.fallbackLng, // will be overridden per request
  interpolation: { escapeValue: false }, // React-safe
  // No need for backend or detection on server
});

// --- Locale cookie logic (CHIPS-compliant for embedded apps) ---
export const localeCookie = createCookie("locale", {
  path: "/",
  httpOnly: false,           // ✅ Required for client-side read
  sameSite: "none",          // ✅ CRITICAL: Required for cross-site iframe (Shopify embed)
  secure: true,              // ✅ CRITICAL: Must be true when sameSite="none"
  maxAge: 60 * 60 * 24 * 365, // 1 year
  // ✅ Partitioned cookies (CHIPS) for Safari/Chrome 2025+ compliance
  // This ensures cookies work in 3rd-party contexts (Shopify Admin iframe)
  // @ts-ignore - Remix doesn't have Partitioned type yet
  partitioned: true,
  // 🔥 CRITICAL: DO NOT set `domain` — let browser infer it
});

export async function getLocaleFromRequest(request: Request): Promise<SupportedLocale> {
  const url = new URL(request.url);

  try {
    // PRIORITY 1: Check cookie (user's explicit choice)
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
      const cookieValue = await localeCookie.parse(cookieHeader);
      if (typeof cookieValue === "string" && i18nConfig.supportedLngs.includes(cookieValue)) {
        console.log(`[getLocaleFromRequest] ✅ Using locale from COOKIE: ${cookieValue}`);
        return cookieValue as SupportedLocale;
      } else {
        console.log(`[getLocaleFromRequest] ⚠️ Invalid cookie value:`, cookieValue);
      }
    } else {
      console.log(`[getLocaleFromRequest] ℹ️ No cookie header found`);
    }

    // PRIORITY 2: Check URL param (Shopify iframe default - lower priority)
    const localeParam = url.searchParams.get("locale");
    if (localeParam && i18nConfig.supportedLngs.includes(localeParam)) {
      console.log(`[getLocaleFromRequest] ⚠️ Using locale from URL: ${localeParam} (cookie not found)`);
      return localeParam as SupportedLocale;
    }
  } catch (err) {
    console.error("[getLocaleFromRequest] ❌ Error reading locale:", err);
  }

  // PRIORITY 3: Fallback to default
  console.log(`[getLocaleFromRequest] ℹ️ Using fallback locale: ${i18nConfig.fallbackLng}`);
  return i18nConfig.fallbackLng as SupportedLocale;
}

export function getRouteNamespaces(): DefaultNamespace[] {
  return ["common"];
}