// app/routes/set-locale.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { localeCookie } from "../i18n/i18next.server";
import i18nConfig from "../i18n";

/**
 * Sets the user's locale preference via cookie.
 * Returns JSON instead of redirect to avoid iframe session issues.
 *
 * Usage from client:
 * ```ts
 * await fetch('/set-locale', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ locale: 'es' })
 * });
 * window.location.reload(); // Reload to apply new locale
 * ```
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    let locale: string | undefined;

    // Support both JSON and FormData
    const contentType = request.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      locale = body.locale;
    } else {
      const formData = await request.formData();
      locale = formData.get("locale")?.toString();
    }

    console.log(`[set-locale.action] Received locale request:`, locale);

    if (!locale || !i18nConfig.supportedLngs.includes(locale)) {
      console.error(`[set-locale.action] ❌ Invalid locale:`, locale);
      return json(
        { success: false, error: "Invalid locale" },
        { status: 400 }
      );
    }

    console.log(`[set-locale.action] ✅ Setting locale cookie: ${locale}`);

    // Return success with Set-Cookie header (no redirect)
    return json(
      { success: true, locale },
      {
        headers: {
          "Set-Cookie": await localeCookie.serialize(locale),
        },
      }
    );
  } catch (error) {
    console.error("[set-locale.action] ❌ Error:", error);
    return json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export default function SetLocale() {
  return null;
}