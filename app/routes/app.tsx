import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useTranslation } from "react-i18next";
import { json } from "@remix-run/node";
import { Box } from "@shopify/polaris";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const { getLocaleFromRequest } = await import("../i18n/i18next.server");
  const locale = await getLocaleFromRequest(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    locale,
  });
};

export const handle = {
  i18n: "common",
};

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const { i18n, t } = useTranslation();

  // Sync i18n with server locale on load
  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          {t("nav.home")}
        </Link>
        <Link to="/app/settings">{t("nav.settings")}</Link>
        <Link to="/app/analytics">{t("nav.analytics")}</Link>
        <Link to="/app/additional">{t("nav.additional")}</Link>
      </NavMenu>

      <Box paddingInlineStart="400" paddingInlineEnd="400" paddingBlockStart="400">
        <Outlet />
      </Box>
    </AppProvider>
  );
}

// Shopify needs Remix to catch thrown responses for headers
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
