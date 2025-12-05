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
import { ErrorBoundary as SentryErrorBoundary } from "./lib/sentry.client";

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
        <SentryErrorBoundary fallback={ErrorFallback}>
          <Outlet />
        </SentryErrorBoundary>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Error fallback component for when errors occur in Sentry Error Boundary
 */
function ErrorFallback({ error, componentStack }: { error: Error; componentStack?: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Oops! Something went wrong</h1>
      <p>We're sorry, but something unexpected happened. Our team has been notified.</p>
      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: '2rem' }}>
          <summary>Error details (development only)</summary>
          <pre style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {error.message}
            {'\n\n'}
            {error.stack}
            {componentStack && '\n\nComponent Stack:\n' + componentStack}
          </pre>
        </details>
      )}
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '2rem',
          padding: '0.5rem 1rem',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Reload page
      </button>
    </div>
  );
}

/**
 * Remix ErrorBoundary for route-level errors
 */
export function ErrorBoundary() {
  const error = useRouteError();

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