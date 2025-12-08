import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import { captureException } from "./lib/sentry.client";
import { useChangeLanguage } from "remix-i18next/react";

import { LanguageSwitcher } from "./components/LanguageSwitcher"; // ✅ import switcher

// Tailwind
import "./styles/tailwind.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const { getLocaleFromRequest } = await import("./i18n/i18next.server");
  const locale = await getLocaleFromRequest(request);

  return json({
    locale,
    ENV: {
      SENTRY_DSN: process.env.SENTRY_DSN,
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}

export const handle = {
  i18n: "common",
};

export default function App() {
  const data = useLoaderData<typeof loader>();
  const { locale } = data;

  useChangeLanguage(locale);

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
      </head>
      <body className="relative">
        {/* ✅ Language switcher at top right corner */}
        <div className="fixed top-4 right-4 z-50">
          <LanguageSwitcher locale={locale} />
        </div>

        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    if (error instanceof Error) {
      captureException(error, {
        context: "Remix ErrorBoundary",
        errorType: "route-error",
      });
    }
  }, [error]);

  if (isRouteErrorResponse(error)) {
    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>{error.status} {error.statusText}</title>
          <Links />
        </head>
        <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          <h1>{error.status} {error.statusText}</h1>
          <p>{error.data}</p>
          <a href="/" style={{ color: "#007bff" }}>Go home</a>
        </body>
      </html>
    );
  }

  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorStack = error instanceof Error ? error.stack : "";

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
        <Links />
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Error</h1>
        <p>Something went wrong.</p>
        {process.env.NODE_ENV === "development" && (
          <details style={{ marginTop: "2rem" }}>
            <summary>Error details (development only)</summary>
            <pre style={{
              background: "#f5f5f5",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto"
            }}>
              {errorMessage}
              {errorStack && "\n\n" + errorStack}
            </pre>
          </details>
        )}
        <a href="/" style={{ color: "#007bff", marginTop: "2rem", display: "inline-block" }}>
          Go home
        </a>
      </body>
    </html>
  );
}
