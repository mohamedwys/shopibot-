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
import i18nServer from "./i18n.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";
import frCommon from "./locales/fr/common.json";
import deCommon from "./locales/de/common.json";
import jaCommon from "./locales/ja/common.json";
import itCommon from "./locales/it/common.json";
import ptCommon from "./locales/pt/common.json";
import zhCommon from "./locales/zh/common.json";

// Initialize Sentry for server-side error tracking
initSentry();

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  // Get locale from request
  const locale = await i18nServer.getLocale(request);

  // Create i18next instance for this request
  const instance = createInstance();
  const ns = i18nServer.getRouteNamespaces(remixContext);

  // Bundle translations directly for serverless compatibility
  const resources = {
    en: { common: enCommon },
    es: { common: esCommon },
    fr: { common: frCommon },
    de: { common: deCommon },
    ja: { common: jaCommon },
    it: { common: itCommon },
    pt: { common: ptCommon },
    zh: { common: zhCommon },
  };

  await instance
    .use(initReactI18next)
    .init({
      ...i18nServer.options,
      lng: locale,
      ns,
      resources,
    });

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
            context: 'Shell rendering error',
            url: request.url,
          });
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          captureException(error instanceof Error ? error : new Error(String(error)), {
            context: 'React rendering error',
            url: request.url,
          });
          console.error(error);
        },
      }
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
