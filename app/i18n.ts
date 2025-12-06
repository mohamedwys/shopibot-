export default {
<<<<<<< HEAD
  supportedLngs: ["en", "es", "fr", "de"],
  fallbackLng: "en",
  defaultNS: "common",
=======
  // This is the list of languages your application supports
  supportedLngs: ["en", "es", "fr", "de", "ja", "it", "pt", "zh"],
  // This is the language you want to use in case
  // if the user language is not in the supportedLngs
  fallbackLng: "en",
  // The default namespace of i18next is "translation", but you can customize it here
  defaultNS: "common",
  // Disabling suspense is recommended for Remix
>>>>>>> origin/claude/shopify-app-readiness-report-01RvCwuH1cAAmdnTxHerbfsB
  react: { useSuspense: false },
};
