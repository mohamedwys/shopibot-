// app/routes/set-locale.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { localeCookie } from "../i18n/i18next.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const locale = formData.get("locale")?.toString();
  const returnTo = formData.get("returnTo")?.toString() || "/app";

  const supportedLocales = ["en", "es", "fr", "de", "it", "pt", "ja", "zh"];
  if (locale && supportedLocales.includes(locale)) {
    return redirect(returnTo, {
      headers: {
        "Set-Cookie": await localeCookie.serialize(locale),
      },
    });
  }

  return redirect(returnTo);
}

export default function SetLocale() {
  return null;
}