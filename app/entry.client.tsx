import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry.client";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { getInitialNamespaces } from "remix-i18next/client";
import i18n from "./i18n";

// Initialize Sentry for client-side error tracking
initSentry();

async function hydrate() {
  await i18next
    .use(initReactI18next)
    .use(LanguageDetector)
    .use(Backend)
    .init({
      ...i18n,
      ns: getInitialNamespaces(),
      backend: {
        loadPath: "/locales/{{lng}}/{{ns}}.json",
      },
      detection: {
        // Read language from cookie, localStorage, or HTML tag
        order: ["cookie", "localStorage", "htmlTag"],
        // Store language preference in cookie and localStorage
        caches: ["cookie", "localStorage"],
        // Use the same cookie name as the server
        cookieMinutes: 525600, // 1 year
        cookieDomain: window.location.hostname,
      },
    });

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <RemixBrowser />
        </StrictMode>
      </I18nextProvider>
    );
  });
}

if (window.requestIdleCallback) {
  window.requestIdleCallback(hydrate);
} else {
  window.setTimeout(hydrate, 1);
}
