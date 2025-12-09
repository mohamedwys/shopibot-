import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { Box } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useEffect, useState } from "react";
import { useTranslation, I18nextProvider } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getLocaleFromRequest } from "../i18n/i18next.server";
import { boundary } from "@shopify/shopify-app-remix/server";
import i18nClient from "../i18n/i18next.client";
import { loadPolarisTranslations } from "../lib/polaris-i18n";
import type { SupportedLocale } from "../i18n/resources";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const locale = await getLocaleFromRequest(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    locale,
  });
};

export const handle = { i18n: "common" };

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const { i18n, t } = useTranslation();
  const [polarisTranslations, setPolarisTranslations] = useState<Record<string, any> | undefined>();

  // Load Polaris translations for the current locale
  useEffect(() => {
    let isMounted = true;

    async function loadTranslations() {
      const translations = await loadPolarisTranslations(locale as SupportedLocale);
      if (isMounted) {
        setPolarisTranslations(translations);
        console.log(`[app.tsx] Polaris translations loaded for: ${locale}`);
      }
    }

    loadTranslations();

    return () => {
      isMounted = false;
    };
  }, [locale]);

  // Sync i18n with server locale
  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
      console.log(`[app.tsx] Changed i18n language to: ${locale}`);
    }
  }, [locale, i18n]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey} i18n={polarisTranslations}>
      <I18nextProvider i18n={i18nClient}>
        <NavMenu>
          <Link to="/app">{t("nav.home")}</Link>
          <Link to="/app/settings">{t("nav.settings")}</Link>
          <Link to="/app/analytics">{t("nav.analytics")}</Link>
          <Link to="/app/additional">{t("nav.additional")}</Link>
        </NavMenu>
        <Box paddingInlineStart="400" paddingInlineEnd="400" paddingBlockStart="400">
          <Outlet />
        </Box>
      </I18nextProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
