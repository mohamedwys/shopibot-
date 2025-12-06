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
});
