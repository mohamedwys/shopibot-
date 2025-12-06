<<<<<<< HEAD
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import Backend from "i18next-fs-backend";

export const i18n = new RemixI18Next({
  detection: {
    supportedLanguages: ["en", "es", "fr", "de"],
    fallbackLanguage: "en",
  },
  i18next: {
    backend: {
      loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
    },
  },
  backend: Backend,
=======
import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n";

export default new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
  },
  // The i18next configuration will be loaded from ./i18n.ts
  i18next: {
    ...i18n,
  },
>>>>>>> origin/claude/shopify-app-readiness-report-01RvCwuH1cAAmdnTxHerbfsB
});
