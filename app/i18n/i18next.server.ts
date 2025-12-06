import { RemixI18Next } from "remix-i18next/server";
import i18nConfig from "./index";
import { resources } from "./resources";

// Create RemixI18Next instance with bundled resources
const i18nServer = new RemixI18Next({
  detection: {
    supportedLanguages: i18nConfig.supportedLngs,
    fallbackLanguage: i18nConfig.fallbackLng,
    // Read locale from cookie
    cookie: {
      name: "locale",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
    },
  },
  // i18next configuration
  i18next: {
    ...i18nConfig,
    // Provide resources directly for serverless compatibility
    resources,
  },
});

export default i18nServer;
