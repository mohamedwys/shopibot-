import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getLocaleFromRequest, getRouteNamespaces } from "../i18n/i18next.server";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "../i18n/resources";

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = await getLocaleFromRequest(request);
  const ns = getRouteNamespaces();

  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: locale,
    ns,
    resources,
  });

  return json({
    success: true,
    locale,
    availableLanguages: Object.keys(resources),
    namespaces: ns,
  });
}
