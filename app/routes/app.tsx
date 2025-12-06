import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useSubmit } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useTranslation } from "react-i18next";
import { json } from "@remix-run/node";
import i18nServer from "../i18n.server";
import { Select, Box, InlineStack } from "@shopify/polaris";
import { useCallback } from "react";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const locale = await i18nServer.getLocale(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    locale,
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const formData = await request.formData();
  const locale = formData.get("locale") as string;

  return json({ locale }, {
    headers: {
      "Set-Cookie": `locale=${locale}; Path=/; Max-Age=31536000`,
    },
  });
};

export const handle = {
  i18n: "common",
};

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const submit = useSubmit();

  const languageOptions = [
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "Français", value: "fr" },
    { label: "Deutsch", value: "de" },
    { label: "日本語", value: "ja" },
    { label: "Italiano", value: "it" },
    { label: "Português", value: "pt" },
    { label: "中文", value: "zh" },
  ];

  const handleLanguageChange = useCallback((value: string) => {
    const formData = new FormData();
    formData.append("locale", value);
    submit(formData, { method: "post" });
  }, [submit]);

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
        <InlineStack align="end">
          <Box minWidth="150px">
            <Select
              label={t("common.language")}
              labelHidden
              options={languageOptions}
              value={locale}
              onChange={handleLanguageChange}
            />
          </Box>
        </InlineStack>
      </Box>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
