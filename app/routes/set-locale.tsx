import { redirect } from "@remix-run/node";
import { localeCookie } from "../i18n/i18next.server";

// Use the built-in fetch Request type
export const action = async ({ request }: { request: globalThis.Request }) => {
  const formData = await request.formData();
  const newLocale = formData.get("locale")?.toString();

  if (!newLocale) return null;

  return redirect("/", {
    headers: {
      "Set-Cookie": await localeCookie.serialize(newLocale),
    },
  });
};
