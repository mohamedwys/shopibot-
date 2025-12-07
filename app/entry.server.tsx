import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { initSentry, captureException } from "./lib/sentry.server";
import { createInstance } from "i18next";
import i18nServer from "./i18n/i18next.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { resources } from "./i18n/resources";

// Initialize Sentry for server-side error tracking
initSentry();

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  console.log('🚀 [entry.server] handleRequest START', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  try {
    addDocumentResponseHeaders(request, responseHeaders);
    console.log('✅ [entry.server] addDocumentResponseHeaders completed');

    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? '')
      ? "onAllReady"
      : "onShellReady";
    console.log('✅ [entry.server] Bot detection:', { callbackName, userAgent });

    // Get locale from request using remix-i18next
    console.log('🔄 [entry.server] Getting locale from request...');
    const locale = await i18nServer.getLocale(request);
    console.log('✅ [entry.server] Locale detected:', locale);

    // Create i18next instance for this request
    console.log('🔄 [entry.server] Creating i18next instance...');
    const instance = createInstance();
    console.log('✅ [entry.server] i18next instance created');

    console.log('🔄 [entry.server] Getting route namespaces...');
    const ns = i18nServer.getRouteNamespaces(remixContext);
    console.log('✅ [entry.server] Route namespaces:', ns);

    console.log('🔄 [entry.server] Checking resources availability...');
    console.log('📦 [entry.server] Resources object keys:', Object.keys(resources));
    console.log('📦 [entry.server] Locale resources available:', !!resources[locale as keyof typeof resources]);

    // Initialize i18next with bundled resources (serverless-compatible)
    console.log('🔄 [entry.server] Initializing i18next...');
    await instance
      .use(initReactI18next)
      .init({
        ...i18nServer.options,
        lng: locale,
        ns,
        resources, // Bundled translations from app/i18n/resources.ts
      });
    console.log('✅ [entry.server] i18next initialized successfully');

    console.log('🔄 [entry.server] Starting React rendering...');
    return new Promise((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <I18nextProvider i18n={instance}>
          <RemixServer
            context={remixContext}
            url={request.url}
          />
        </I18nextProvider>,
        {
          [callbackName]: () => {
            console.log('✅ [entry.server] React shell rendered successfully');
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set("Content-Type", "text/html");
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
            console.log('✅ [entry.server] Response sent');
          },
          onShellError(error) {
            console.error('❌ [entry.server] SHELL ERROR:', error);
            console.error('❌ [entry.server] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            captureException(error instanceof Error ? error : new Error(String(error)), {
              context: 'Shell rendering error',
              url: request.url,
            });
            reject(error);
          },
          onError(error) {
            console.error('❌ [entry.server] RENDER ERROR:', error);
            console.error('❌ [entry.server] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            responseStatusCode = 500;
            captureException(error instanceof Error ? error : new Error(String(error)), {
              context: 'React rendering error',
              url: request.url,
            });
          },
        }
      );

      // Automatically timeout the React renderer after 6 seconds, which ensures
      // React has enough time to flush down the rejected boundary contents
      setTimeout(abort, streamTimeout + 1000);
    });
  } catch (error) {
    console.error('❌ [entry.server] FATAL ERROR in handleRequest:', error);
    console.error('❌ [entry.server] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown',
    });
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'Fatal handleRequest error',
      url: request.url,
    });
    throw error;
  }
}
