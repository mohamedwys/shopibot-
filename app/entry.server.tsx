import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable, type EntryContext } from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { initSentry, captureException } from "./lib/sentry.server";

import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { resources } from "./i18n/resources";
import { getLocaleFromRequest, getRouteNamespaces, i18nextOptions } from "./i18n/i18next.server";

// Initialize Sentry
initSentry();

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  try {
    addDocumentResponseHeaders(request, responseHeaders);

    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

    // 1️⃣ Get locale
    const locale = await getLocaleFromRequest(request);

    // 2️⃣ Create i18next instance for SSR
    const i18nInstance = createInstance();
    const namespaces = getRouteNamespaces(); // ["common"] by default

    await i18nInstance.use(initReactI18next).init({
      ...i18nextOptions,
      lng: locale,
      ns: namespaces,
      resources,
    });

    return new Promise<Response>((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <I18nextProvider i18n={i18nInstance}>
          <RemixServer context={remixContext} url={request.url} />
        </I18nextProvider>,
        {
          [callbackName]: () => {
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
          },
          onShellError(error) {
            captureException(error instanceof Error ? error : new Error(String(error)), {
              context: "SSR Shell error",
              url: request.url,
            });
            reject(error);
          },
          onError(error) {
            responseStatusCode = 500;
            captureException(error instanceof Error ? error : new Error(String(error)), {
              context: "SSR render error",
              url: request.url,
            });
          },
        }
      );

      setTimeout(abort, streamTimeout + 1000);
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: "SSR fatal error",
      url: request.url,
    });
    throw error;
  }
}
