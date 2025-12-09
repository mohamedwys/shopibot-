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

// --- Locale cookie logic (unchanged) ---
export const localeCookie = createCookie("locale", {
  path: "/",
  httpOnly: false,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
});

export async function getLocaleFromRequest(request: Request): Promise<SupportedLocale> {
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
      const cookieValue = await localeCookie.parse(cookieHeader);
      if (typeof cookieValue === "string" && i18nConfig.supportedLngs.includes(cookieValue)) {
        return cookieValue as SupportedLocale;
      }
    }

    const url = new URL(request.url);
    const localeParam = url.searchParams.get("locale");
    if (localeParam && i18nConfig.supportedLngs.includes(localeParam)) {
      return localeParam as SupportedLocale;
    }
  } catch (err) {
    console.error("[i18next.server] Error reading locale:", err);
  }

  return i18nConfig.fallbackLng as SupportedLocale;
}

export function getRouteNamespaces(): DefaultNamespace[] {
  return ["common"];
}