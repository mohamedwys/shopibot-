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

// ADD THIS LINE - Import your Tailwind CSS
import "./styles/tailwind.css";

/**
 * Loader to expose environment variables to the client
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    ENV: {
      SENTRY_DSN: process.env.SENTRY_DSN,
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}

export default function App() {
  const data = useLoaderData<typeof loader>();

  return (
    <html>
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
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Remix ErrorBoundary for route-level errors
 * Captures errors and sends them to Sentry
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // Capture error in Sentry (client-side)
  useEffect(() => {
    if (error instanceof Error) {
      captureException(error, {
        context: 'Remix ErrorBoundary',
        errorType: 'route-error',
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
        <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
          <h1>{error.status} {error.statusText}</h1>
          <p>{error.data}</p>
          <a href="/" style={{ color: '#007bff' }}>Go home</a>
        </body>
      </html>
    );
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : '';

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
        <Links />
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Error</h1>
        <p>Something went wrong.</p>
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '2rem' }}>
            <summary>Error details (development only)</summary>
            <pre style={{
              background: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px',
              overflow: 'auto'
            }}>
              {errorMessage}
              {errorStack && '\n\n' + errorStack}
            </pre>
          </details>
        )}
        <a href="/" style={{ color: '#007bff', marginTop: '2rem', display: 'inline-block' }}>
          Go home
        </a>
      </body>
    </html>
  );
}