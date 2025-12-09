// app/routes/set-locale.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { localeCookie } from "../i18n/i18next.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const locale = formData.get("locale")?.toString();
  const returnTo = formData.get("returnTo")?.toString() || "/app";

  // Only allow your supported locales
  const supportedLocales = ["en", "es", "fr", "de", "it", "pt", "ja", "zh"];
  if (locale && supportedLocales.includes(locale)) {
    return redirect(returnTo, {
      headers: {
        "Set-Cookie": await localeCookie.serialize(locale),
      },
    });
  }

  // Fallback if invalid locale
  return redirect(returnTo);
}

// No UI needed — this is a background action-only route
export default function SetLocale() {
  return null;
}