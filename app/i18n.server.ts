import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import Backend from "i18next-fs-backend";
import i18n from "./i18n";

export default new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    // Configure detection order - cookie first, then header
    order: ["cookie", "header"],
  },
  i18next: {
    ...i18n,
    backend: {
      loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
    },
  },
  backend: Backend,
});
