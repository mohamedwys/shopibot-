import { resolve, join } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import Backend from "i18next-fs-backend";
import i18n from "./i18n";

// Get the correct path for locales in both dev and production
const localesPath = process.env.NODE_ENV === "production"
  ? join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json")
  : resolve("./public/locales/{{lng}}/{{ns}}.json");

export default new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    // Configure cookie detection - order matters!
    order: ["cookie", "header"],
    // Cookie name must match what the client uses (i18next-browser-languagedetector default)
    cookie: "i18next",
  },
  i18next: {
    ...i18n,
    backend: {
      loadPath: localesPath,
    },
  },
  backend: Backend,
});
